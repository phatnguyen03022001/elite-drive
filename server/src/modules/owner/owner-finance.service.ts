import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { assertVndAmount } from '../../common/money/vnd';
import { PrismaService } from '../../prisma/prisma.service';
import { WithdrawRequestDto } from './dto/owner.dto';

@Injectable()
export class OwnerFinanceService {
  private readonly logger = new Logger(OwnerFinanceService.name);

  constructor(private readonly db: PrismaService) {}

  async getEarnings(userId: string, query: PaginationDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.OwnerTransactionWhereInput = {
      ownerId: userId,
      type: 'RENTAL_INCOME',
      status: 'completed',
    };

    const [data, total, aggregate] = await Promise.all([
      this.db.ownerTransaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.ownerTransaction.count({ where }),
      this.db.ownerTransaction.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    const totalEarnings = aggregate._sum.amount ?? 0;
    assertVndAmount(totalEarnings, {
      allowZero: true,
      field: 'Tổng thu nhập owner',
    });

    return {
      data,
      total,
      page,
      limit,
      totalEarnings,
    };
  }

  async getTransactions(userId: string, query: PaginationDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.OwnerTransactionWhereInput = { ownerId: userId };
    const [data, total] = await Promise.all([
      this.db.ownerTransaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.ownerTransaction.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async getWallet(userId: string) {
    const wallet = await this.db.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0, currency: 'VND' },
    });
    assertVndAmount(wallet.balance, {
      allowZero: true,
      field: 'Số dư ví owner',
    });
    return wallet;
  }

  async requestWithdraw(userId: string, dto: WithdrawRequestDto) {
    assertVndAmount(dto.amount, { min: 50000, field: 'Số tiền rút' });

    const bankAccountNumber = dto.bankAccountNumber.trim();
    const bankAccountName = dto.bankAccountName.trim().replace(/\s+/g, ' ');
    const description = dto.description?.trim() || undefined;
    if (!bankAccountNumber || !bankAccountName) {
      throw new BadRequestException('Thông tin tài khoản nhận payout là bắt buộc');
    }

    const withdrawId = createHash('sha256')
      .update(`withdraw:${userId}:${dto.idempotencyKey}`)
      .digest('hex')
      .slice(0, 24);

    const existing = await this.db.ownerTransaction.findUnique({
      where: { id: withdrawId },
    });
    if (existing) {
      this.assertSameWithdrawRequest(existing, {
        userId,
        amount: dto.amount,
        bankAccountNumber,
        bankAccountName,
      });
      return existing;
    }

    try {
      const result = await this.db.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet) {
          throw new BadRequestException('Wallet chưa được tạo');
        }
        assertVndAmount(wallet.balance, {
          allowZero: true,
          field: 'Số dư ví',
        });

        const reserve = await tx.wallet.updateMany({
          where: {
            userId,
            balance: { gte: dto.amount },
          },
          data: { balance: { decrement: dto.amount } },
        });
        if (reserve.count !== 1) {
          throw new BadRequestException('Số dư không đủ');
        }

        const withdraw = await tx.ownerTransaction.create({
          data: {
            id: withdrawId,
            ownerId: userId,
            amount: dto.amount,
            type: 'WITHDRAW',
            status: 'pending',
            description: `Withdraw request - ${description ?? 'No reason provided'}`,
            metadata: {
              idempotencyKey: dto.idempotencyKey,
              bankAccountNumber,
              bankAccountName,
            },
          },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: -dto.amount,
            type: 'WITHDRAW_PENDING',
            description: `Withdraw request #${withdraw.id}`,
            metadata: {
              withdrawId: withdraw.id,
              idempotencyKey: dto.idempotencyKey,
              bankAccountNumber,
            },
          },
        });

        return withdraw;
      });

      this.logger.log(`Created withdraw ${result.id} for owner ${userId}`);
      return result;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replay = await this.db.ownerTransaction.findUnique({
          where: { id: withdrawId },
        });
        if (replay) {
          this.assertSameWithdrawRequest(replay, {
            userId,
            amount: dto.amount,
            bankAccountNumber,
            bankAccountName,
          });
          return replay;
        }
      }
      throw error;
    }
  }

  private assertSameWithdrawRequest(
    existing: {
      ownerId: string;
      amount: number;
      type: string;
      metadata: Prisma.JsonValue | null;
    },
    expected: {
      userId: string;
      amount: number;
      bankAccountNumber: string;
      bankAccountName: string;
    },
  ) {
    if (
      existing.ownerId !== expected.userId ||
      existing.type !== 'WITHDRAW' ||
      existing.amount !== expected.amount
    ) {
      throw new BadRequestException(
        'Idempotency key đã được dùng cho yêu cầu rút tiền khác',
      );
    }

    const metadata = this.jsonObject(existing.metadata);
    const existingNumber =
      typeof metadata?.bankAccountNumber === 'string'
        ? metadata.bankAccountNumber.trim()
        : '';
    const existingName =
      typeof metadata?.bankAccountName === 'string'
        ? metadata.bankAccountName.trim().replace(/\s+/g, ' ')
        : '';

    if (
      existingNumber !== expected.bankAccountNumber ||
      existingName !== expected.bankAccountName
    ) {
      throw new BadRequestException(
        'Idempotency key đã được dùng cho tài khoản payout khác',
      );
    }
  }

  private jsonObject(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Prisma.JsonObject;
  }
}
