import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { WithdrawRequestDto } from './dto/owner.dto';
import { OwnerService } from './owner.service';

@Injectable()
export class SecureOwnerService extends OwnerService {
  private readonly logger = new Logger(SecureOwnerService.name);

  constructor(
    private readonly db: PrismaService,
    uploadService: UploadService,
  ) {
    super(db, uploadService);
  }

  override async getEarnings(userId: string, query: PaginationDto = {}) {
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

    return {
      data,
      total,
      page,
      limit,
      totalEarnings: aggregate._sum.amount ?? 0,
    };
  }

  override async requestWithdraw(userId: string, dto: WithdrawRequestDto) {
    if (!Number.isFinite(dto.amount) || dto.amount < 50000) {
      throw new BadRequestException('Số tiền rút không hợp lệ');
    }

    const withdrawId = createHash('sha256')
      .update(`withdraw:${userId}:${dto.idempotencyKey}`)
      .digest('hex')
      .slice(0, 24);

    const existing = await this.db.ownerTransaction.findUnique({
      where: { id: withdrawId },
    });
    if (existing) {
      if (existing.ownerId !== userId || existing.type !== 'WITHDRAW') {
        throw new BadRequestException('Idempotency key không hợp lệ');
      }
      return existing;
    }

    try {
      const result = await this.db.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet) {
          throw new BadRequestException('Wallet chưa được tạo');
        }

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
            description: `Withdraw request - ${dto.description ?? 'No reason provided'}`,
            metadata: {
              idempotencyKey: dto.idempotencyKey,
              bankAccountNumber: dto.bankAccountNumber,
              bankAccountName: dto.bankAccountName,
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
        if (replay && replay.ownerId === userId && replay.type === 'WITHDRAW') {
          return replay;
        }
      }
      throw error;
    }
  }
}
