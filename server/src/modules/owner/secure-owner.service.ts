import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { WithdrawRequestDto } from './dto/owner.dto';
import { OwnerService } from './owner.service';

@Injectable()
export class SecureOwnerService extends OwnerService {
  constructor(
    private readonly db: PrismaService,
    uploadService: UploadService,
  ) {
    super(db, uploadService);
  }

  override async requestWithdraw(userId: string, dto: WithdrawRequestDto) {
    if (!Number.isFinite(dto.amount) || dto.amount < 50000) {
      throw new BadRequestException('Số tiền rút không hợp lệ');
    }

    return this.db.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) {
        throw new BadRequestException('Wallet chưa được tạo');
      }

      // Reserve funds atomically. Concurrent requests can no longer both pass
      // a stale balance check and push the wallet below zero.
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
          ownerId: userId,
          amount: dto.amount,
          type: 'WITHDRAW',
          status: 'pending',
          description: `Withdraw request - ${dto.description ?? 'No reason provided'}`,
          metadata: {
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
          metadata: { withdrawId: withdraw.id },
        },
      });

      return withdraw;
    });
  }
}
