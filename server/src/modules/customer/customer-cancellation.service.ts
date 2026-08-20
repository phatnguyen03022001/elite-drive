import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { assertVndAmount } from '../../common/money/vnd';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CustomerCancellationService {
  private readonly platformUserId: string;

  constructor(
    private readonly db: PrismaService,
    config: ConfigService,
  ) {
    this.platformUserId = config.getOrThrow<string>('PLATFORM_USER_ID');
  }

  async cancelBooking(userId: string, bookingId: string) {
    return this.db.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, customerId: userId },
        include: { payments: true, trip: true },
      });
      if (!booking) throw new NotFoundException('Không tìm thấy đơn đặt xe');

      if (
        booking.trip?.status === 'ONGOING' ||
        booking.trip?.status === 'COMPLETED'
      ) {
        throw new BadRequestException(
          'Không thể hủy booking sau khi chuyến đi đã bắt đầu',
        );
      }

      const completedPayment = booking.payments.find(
        (payment) => payment.status === PaymentStatus.COMPLETED,
      );
      if (completedPayment?.paymentMethod.toUpperCase() === 'MOMO') {
        throw new BadRequestException(
          'Booking đã thanh toán MoMo cần provider refund/reversal; vui lòng liên hệ hỗ trợ',
        );
      }
      if (completedPayment?.releasedAt) {
        throw new BadRequestException(
          'Payment đã được giải ngân; cần reversal/adjustment flow riêng',
        );
      }

      const bookingClaim = await tx.booking.updateMany({
        where: {
          id: bookingId,
          customerId: userId,
          status: {
            in: [
              BookingStatus.PENDING,
              BookingStatus.APPROVED,
              BookingStatus.CONFIRMED,
            ],
          },
          OR: [
            { trip: null },
            { trip: { is: { status: 'UPCOMING' } } },
          ],
        },
        data: { status: BookingStatus.CANCELLED },
      });
      if (bookingClaim.count !== 1) {
        throw new BadRequestException(
          'Booking đã được xử lý, trip đã bắt đầu hoặc không thể hủy',
        );
      }

      if (booking.promotionId) {
        await tx.promotion.updateMany({
          where: { id: booking.promotionId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }

      if (!completedPayment) {
        return tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      }

      assertVndAmount(completedPayment.amount, { field: 'Số tiền hoàn' });
      assertVndAmount(booking.totalPrice, { field: 'Tổng tiền booking' });
      if (completedPayment.amount !== booking.totalPrice) {
        throw new BadRequestException(
          'Payment không khớp tổng tiền booking; không thể tự động hoàn tiền',
        );
      }

      const refundClaim = await tx.payment.updateMany({
        where: {
          id: completedPayment.id,
          status: PaymentStatus.COMPLETED,
          refundedAt: null,
          OR: [
            { releasedAt: null },
            { releasedAt: { isSet: false } },
          ],
        },
        data: {
          status: PaymentStatus.REFUNDED,
          refundedAt: new Date(),
          failureReason: 'Refund 100%: CUSTOMER_CANCEL',
        },
      });
      if (refundClaim.count !== 1) {
        throw new BadRequestException(
          'Payment đã được xử lý hoặc không còn nằm trong escrow',
        );
      }

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
          balance: { gte: completedPayment.amount },
        },
        data: { balance: { decrement: completedPayment.amount } },
      });
      if (escrowDebit.count !== 1) {
        throw new BadRequestException('Số dư escrow không đủ để hoàn tiền');
      }

      const customerWallet = await tx.wallet.upsert({
        where: { userId },
        create: { userId, balance: completedPayment.amount, currency: 'VND' },
        update: { balance: { increment: completedPayment.amount } },
      });

      await tx.walletTransaction.createMany({
        data: [
          {
            walletId: platformWallet.id,
            amount: -completedPayment.amount,
            type: 'ESCROW_REFUND',
            description: `Hoàn escrow cho booking ${bookingId}`,
            metadata: {
              operation: 'CUSTOMER_CANCEL',
              bookingId,
              paymentId: completedPayment.id,
              counterpartWalletId: customerWallet.id,
            },
          },
          {
            walletId: customerWallet.id,
            amount: completedPayment.amount,
            type: 'REFUND',
            description: `Hoàn tiền đơn ${bookingId}`,
            metadata: {
              operation: 'CUSTOMER_CANCEL',
              bookingId,
              paymentId: completedPayment.id,
              refundPercent: 100,
              counterpartWalletId: platformWallet.id,
            },
          },
        ],
      });

      await tx.trip.deleteMany({
        where: { bookingId, status: 'UPCOMING' },
      });

      return tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    });
  }
}
