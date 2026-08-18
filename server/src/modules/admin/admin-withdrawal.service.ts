import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { assertVndAmount } from '../../common/money/vnd';
import { PrismaService } from '../../prisma/prisma.service';
import { ApproveWithdrawDto } from './dto/admin-withdraw.dto';

@Injectable()
export class AdminWithdrawalService {
  private readonly logger = new Logger(AdminWithdrawalService.name);

  constructor(private readonly db: PrismaService) {}

  async getPending(query: PaginationDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.OwnerTransactionWhereInput = {
      type: 'WITHDRAW',
      status: 'pending',
    };

    const [items, total] = await Promise.all([
      this.db.ownerTransaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      }),
      this.db.ownerTransaction.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async approve(id: string, dto: ApproveWithdrawDto) {
    const externalReference = dto.externalReference.trim();
    if (externalReference.length < 3) {
      throw new BadRequestException('Payout reference không hợp lệ');
    }

    const result = await this.db.$transaction(async (tx) => {
      const withdraw = await tx.ownerTransaction.findUnique({
        where: { id },
        select: {
          id: true,
          ownerId: true,
          amount: true,
          type: true,
          status: true,
          externalReference: true,
          processedAt: true,
        },
      });
      if (!withdraw || withdraw.type !== 'WITHDRAW') {
        throw new NotFoundException('Yêu cầu rút tiền không tồn tại');
      }
      assertVndAmount(withdraw.amount, { field: 'Số tiền rút' });

      if (withdraw.status === 'completed') {
        if (withdraw.externalReference === externalReference) return withdraw;
        throw new BadRequestException(
          'Yêu cầu rút tiền đã hoàn tất với payout reference khác',
        );
      }
      if (withdraw.status !== 'pending') {
        throw new BadRequestException('Yêu cầu rút tiền đã được xử lý');
      }

      const processedAt = new Date();
      const claim = await tx.ownerTransaction.updateMany({
        where: {
          id,
          type: 'WITHDRAW',
          status: 'pending',
          OR: [
            { processedAt: null },
            { processedAt: { isSet: false } },
          ],
        },
        data: {
          status: 'completed',
          externalReference,
          processedAt,
        },
      });
      if (claim.count !== 1) {
        throw new BadRequestException(
          'Yêu cầu rút tiền vừa được xử lý bởi một yêu cầu khác',
        );
      }

      return tx.ownerTransaction.findUniqueOrThrow({ where: { id } });
    });

    this.logger.log(
      `Approved withdraw ${id} with external reference ${externalReference}`,
    );
    return result;
  }

  async reject(id: string, reason: string) {
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      throw new BadRequestException('Lý do từ chối không được để trống');
    }

    await this.db.$transaction(async (tx) => {
      const withdraw = await tx.ownerTransaction.findUnique({
        where: { id },
      });
      if (!withdraw) {
        throw new NotFoundException('Withdraw transaction not found');
      }
      if (withdraw.type !== 'WITHDRAW') {
        throw new BadRequestException('Transaction không phải yêu cầu rút tiền');
      }
      assertVndAmount(withdraw.amount, { field: 'Số tiền rút' });

      const claim = await tx.ownerTransaction.updateMany({
        where: {
          id,
          type: 'WITHDRAW',
          status: 'pending',
          OR: [
            { processedAt: null },
            { processedAt: { isSet: false } },
          ],
        },
        data: {
          status: 'failed',
          processedAt: new Date(),
          description: `Rejected: ${normalizedReason}`,
        },
      });
      if (claim.count !== 1) {
        throw new BadRequestException('Yêu cầu rút tiền đã được xử lý');
      }

      const wallet = await tx.wallet.upsert({
        where: { userId: withdraw.ownerId },
        create: { userId: withdraw.ownerId, balance: withdraw.amount },
        update: { balance: { increment: withdraw.amount } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: withdraw.amount,
          type: 'WITHDRAW_REJECTED',
          description: `Hoàn tiền yêu cầu rút #${id}: ${normalizedReason}`,
          metadata: { withdrawId: id },
        },
      });
    });

    this.logger.warn(`Rejected withdraw ${id}`);
  }
}
