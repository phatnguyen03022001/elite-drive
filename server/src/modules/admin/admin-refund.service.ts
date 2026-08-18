import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { assertVndAmount } from '../../common/money/vnd';
import { PrismaService } from '../../prisma/prisma.service';
import { RefundPaymentDto } from './dto/admin.dto';

@Injectable()
export class AdminRefundService {
  private readonly logger = new Logger(AdminRefundService.name);
  private readonly platformUserId: string;

  constructor(
    private readonly db: PrismaService,
    config: ConfigService,
  ) {
    this.platformUserId = config.getOrThrow<string>('PLATFORM_USER_ID');
  }

  async refundPayment(dto: RefundPaymentDto) {
    const { bookingId, refundPercent = 100, reason } = dto;
    if (refundPercent !== 100) {
      throw new BadRequestException(
        'Partial refund chưa được hỗ trợ bởi payment state model hiện tại',
      );
    }

    const result = await this.db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { payments: true, trip: true },
      });
      if (!booking) throw new NotFoundException('Booking không tồn tại');
      if (
        booking.status === BookingStatus.COMPLETED ||
        booking.trip?.status === 'ONGOING' ||
        booking.trip?.status === 'COMPLETED'
      ) {
        throw new BadRequestException(
          'Booking đã bắt đầu hoặc đã giải ngân; cần reversal/adjustment flow riêng',
        );
      }

      const payment = booking.payments.find(
        (item) => item.status === PaymentStatus.COMPLETED,
      );
      if (!payment) {
        throw new BadRequestException(
          'Đơn hàng chưa được thanh toán hoặc đã được hoàn tiền',
        );
      }
      if (payment.paymentMethod.toUpperCase() === 'MOMO') {
        throw new BadRequestException(
          'MoMo refund/reversal chưa được tích hợp; không thay đổi trạng thái local trước provider confirmation',
        );
      }

      assertVndAmount(payment.amount, { field: 'Số tiền payment' });
      assertVndAmount(booking.totalPrice, { field: 'Tổng tiền booking' });
      if (payment.amount !== booking.totalPrice) {
        throw new BadRequestException('Payment không khớp tổng tiền booking');
      }

      const paymentClaim = await tx.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.COMPLETED },
        data: {
          status: PaymentStatus.REFUNDED,
          refundedAt: new Date(),
          failureReason: `Refund 100%: ${reason.trim()}`,
        },
      });
      if (paymentClaim.count !== 1) {
        throw new BadRequestException('Giao dịch đã được hoàn tiền');
      }

      const refundAmount = payment.amount;
      const platformWallet = await tx.wallet.findUnique({
        where: { userId: this.platformUserId },
      });
      if (!platformWallet) {
        throw new BadRequestException('Ví escrow nền tảng không tồn tại');
      }
      assertVndAmount(platformWallet.balance, {
        allowZero: true,
        field: 'Số dư escrow',
      });

      const escrowDebit = await tx.wallet.updateMany({
        where: {
          id: platformWallet.id,
          balance: { gte: refundAmount },
        },
        data: { balance: { decrement: refundAmount } },
      });
      if (escrowDebit.count !== 1) {
        throw new BadRequestException('Số dư escrow không đủ để hoàn tiền');
      }

      const customerWallet = await tx.wallet.upsert({
        where: { userId: booking.customerId },
        create: { userId: booking.customerId, balance: refundAmount, currency: 'VND' },
        update: { balance: { increment: refundAmount } },
      });
      await tx.walletTransaction.createMany({
        data: [
          {
            walletId: platformWallet.id,
            amount: -refundAmount,
            type: 'ESCROW_REFUND',
            description: `Hoàn escrow booking ${bookingId}: ${reason.trim()}`,
            metadata: {
              operation: 'ADMIN_REFUND',
              bookingId,
              paymentId: payment.id,
              counterpartWalletId: customerWallet.id,
            },
          },
          {
            walletId: customerWallet.id,
            amount: refundAmount,
            type: 'REFUND',
            description: `Hoàn tiền booking ${bookingId}: ${reason.trim()}`,
            metadata: {
              operation: 'ADMIN_REFUND',
              bookingId,
              paymentId: payment.id,
              percent: 100,
              counterpartWalletId: platformWallet.id,
            },
          },
        ],
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

    this.logger.warn(`Refunded booking ${bookingId}`);
    return result;
  }
}
