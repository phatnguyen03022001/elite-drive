import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminService } from './admin.service';

@Injectable()
export class SecureAdminService extends AdminService {
  private readonly platformUserId = '65f1a2b3c4d5e6f7a8b9c0d1';

  constructor(private readonly db: PrismaService) {
    super(db);
  }

  override async releasePayment(dto: {
    bookingId: string;
    platformFeePercent?: number;
  }) {
    const { bookingId, platformFeePercent = 20 } = dto;

    if (
      !Number.isFinite(platformFeePercent) ||
      platformFeePercent < 0 ||
      platformFeePercent > 100
    ) {
      throw new BadRequestException('Phí sàn phải nằm trong khoảng 0-100%');
    }

    return this.db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { payments: true, car: true, trip: true },
      });

      if (!booking) throw new NotFoundException('Booking not found');
      if (!booking.trip || booking.trip.status !== 'COMPLETED') {
        throw new BadRequestException(
          'Chuyến đi chưa hoàn thành, không thể giải ngân',
        );
      }

      const payment = booking.payments.find(
        (item) => item.status === PaymentStatus.COMPLETED,
      );
      if (!payment) {
        throw new BadRequestException(
          'Không tìm thấy giao dịch thanh toán thành công',
        );
      }

      // Claim the booking exactly once. If another request already claimed it,
      // no wallet mutation below is allowed to run.
      const claim = await tx.booking.updateMany({
        where: { id: bookingId, status: BookingStatus.CONFIRMED },
        data: { status: BookingStatus.COMPLETED },
      });
      if (claim.count !== 1) {
        throw new BadRequestException(
          'Booking đã được giải ngân hoặc không còn ở trạng thái có thể giải ngân',
        );
      }

      const platformFee = Math.round((payment.amount * platformFeePercent) / 100);
      const ownerAmount = payment.amount - platformFee;

      const escrowDebit = await tx.wallet.updateMany({
        where: {
          userId: this.platformUserId,
          balance: { gte: payment.amount },
        },
        data: { balance: { decrement: payment.amount } },
      });
      if (escrowDebit.count !== 1) {
        throw new BadRequestException('Số dư escrow không đủ để giải ngân');
      }

      await tx.wallet.upsert({
        where: { userId: booking.car.ownerId },
        create: { userId: booking.car.ownerId, balance: ownerAmount },
        update: { balance: { increment: ownerAmount } },
      });

      await tx.ownerTransaction.create({
        data: {
          ownerId: booking.car.ownerId,
          bookingId: booking.id,
          amount: ownerAmount,
          type: 'RENTAL_INCOME',
          status: 'completed',
          description: `Thu nhập thuê xe (Đã trừ ${platformFeePercent}% phí sàn)`,
          metadata: {
            operation: 'RELEASE_PAYMENT',
            paymentId: payment.id,
            totalPaidByCustomer: payment.amount,
            platformFeeCharged: platformFee,
            feePercentage: platformFeePercent,
          },
        },
      });

      return { success: true, ownerReceived: ownerAmount, platformFee };
    });
  }

  override async refundPayment(dto: {
    bookingId: string;
    refundPercent?: number;
    reason: string;
  }) {
    const { bookingId, refundPercent = 100, reason } = dto;

    if (
      !Number.isFinite(refundPercent) ||
      refundPercent <= 0 ||
      refundPercent > 100
    ) {
      throw new BadRequestException('Tỷ lệ hoàn tiền phải lớn hơn 0 và tối đa 100%');
    }
    if (!reason?.trim()) {
      throw new BadRequestException('Lý do hoàn tiền là bắt buộc');
    }

    return this.db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { payments: true },
      });
      if (!booking) throw new NotFoundException('Booking không tồn tại');

      const payment = booking.payments.find(
        (item) => item.status === PaymentStatus.COMPLETED,
      );
      if (!payment) {
        throw new BadRequestException(
          'Đơn hàng chưa được thanh toán hoặc đã được hoàn tiền',
        );
      }

      // Claim the payment before touching balances. This closes double-refund
      // races because only one concurrent request can transition COMPLETED -> REFUNDED.
      const claim = await tx.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.COMPLETED },
        data: {
          status: PaymentStatus.REFUNDED,
          refundedAt: new Date(),
          failureReason: `Refund ${refundPercent}%: ${reason.trim()}`,
        },
      });
      if (claim.count !== 1) {
        throw new BadRequestException('Giao dịch đã được hoàn tiền');
      }

      const refundAmount = Math.round((payment.amount * refundPercent) / 100);
      const escrowDebit = await tx.wallet.updateMany({
        where: {
          userId: this.platformUserId,
          balance: { gte: refundAmount },
        },
        data: { balance: { decrement: refundAmount } },
      });
      if (escrowDebit.count !== 1) {
        throw new BadRequestException('Số dư escrow không đủ để hoàn tiền');
      }

      const customerWallet = await tx.wallet.upsert({
        where: { userId: booking.customerId },
        create: { userId: booking.customerId, balance: refundAmount },
        update: { balance: { increment: refundAmount } },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: customerWallet.id,
          amount: refundAmount,
          type: 'REFUND',
          description: `Hoàn tiền booking ${bookingId}: ${reason.trim()}`,
          metadata: {
            bookingId,
            paymentId: payment.id,
            percent: refundPercent,
          },
        },
      });

      await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CANCELLED },
      });

      return {
        success: true,
        refundAmount,
        message: 'Đã hoàn tiền vào ví khách hàng',
      };
    });
  }

  override async approveWithdraw(id: string) {
    const result = await this.db.ownerTransaction.updateMany({
      where: { id, type: 'WITHDRAW', status: 'pending' },
      data: { status: 'completed' },
    });

    if (result.count !== 1) {
      throw new BadRequestException(
        'Yêu cầu rút tiền không tồn tại hoặc đã được xử lý',
      );
    }

    return { id, status: 'completed' };
  }

  override async rejectWithdraw(id: string, reason: string) {
    if (!reason?.trim()) {
      throw new BadRequestException('Lý do từ chối là bắt buộc');
    }

    return this.db.$transaction(async (tx) => {
      const withdraw = await tx.ownerTransaction.findUnique({ where: { id } });
      if (!withdraw) {
        throw new NotFoundException('Withdraw transaction not found');
      }
      if (withdraw.type !== 'WITHDRAW') {
        throw new BadRequestException('Transaction không phải yêu cầu rút tiền');
      }

      const claim = await tx.ownerTransaction.updateMany({
        where: { id, type: 'WITHDRAW', status: 'pending' },
        data: { status: 'failed', description: reason.trim() },
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
          description: `Hoàn tiền yêu cầu rút #${id}: ${reason.trim()}`,
          metadata: { withdrawId: id },
        },
      });

      return { id, status: 'failed' };
    });
  }
}
