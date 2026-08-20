import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { assertVndAmount } from '../../common/money/vnd';
import { PrismaService } from '../../prisma/prisma.service';
import { MomoGatewayService } from '../payment/momo-gateway.service';
import { RefundPaymentDto } from './dto/admin.dto';

const MOMO_REFUND_PENDING_CODES = new Set([1000, 7000, 7002]);

@Injectable()
export class AdminRefundService {
  private readonly logger = new Logger(AdminRefundService.name);
  private readonly platformUserId: string;

  constructor(
    private readonly db: PrismaService,
    private readonly momo: MomoGatewayService,
    config: ConfigService,
  ) {
    this.platformUserId = config.getOrThrow<string>('PLATFORM_USER_ID');
  }

  async refundPayment(dto: RefundPaymentDto) {
    const { bookingId, refundPercent = 100 } = dto;
    const reason = dto.reason.trim();
    if (refundPercent !== 100) {
      throw new BadRequestException(
        'Partial refund chưa được hỗ trợ bởi payment state model hiện tại',
      );
    }

    const booking = await this.db.booking.findUnique({
      where: { id: bookingId },
      include: {
        payments: { orderBy: { createdAt: 'desc' } },
        trip: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking không tồn tại');

    const payment =
      booking.payments.find((item) => item.status === PaymentStatus.COMPLETED) ??
      booking.payments.find((item) => item.status === PaymentStatus.REFUNDED);
    if (!payment) {
      throw new BadRequestException(
        'Đơn hàng chưa được thanh toán hoặc không có payment có thể hoàn',
      );
    }

    assertVndAmount(payment.amount, { field: 'Số tiền payment' });
    assertVndAmount(booking.totalPrice, { field: 'Tổng tiền booking' });
    if (payment.amount !== booking.totalPrice) {
      throw new BadRequestException('Payment không khớp tổng tiền booking');
    }

    if (payment.status === PaymentStatus.REFUNDED) {
      return {
        success: true,
        refundAmount: payment.amount,
        message: 'Payment đã được hoàn trước đó',
      };
    }
    if (payment.releasedAt) {
      throw new BadRequestException(
        'Payment đã được giải ngân; cần reversal/adjustment flow riêng',
      );
    }

    if (
      booking.trip?.status === 'ONGOING' ||
      booking.trip?.status === 'COMPLETED'
    ) {
      throw new BadRequestException(
        'Trip đã bắt đầu hoặc hoàn tất; cần reversal/adjustment flow riêng',
      );
    }

    if (payment.paymentMethod.toUpperCase() === 'MOMO') {
      return this.refundMomoPayment({
        bookingId,
        customerId: booking.customerId,
        bookingStatus: booking.status,
        payment,
        reason,
      });
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Booking không còn ở trạng thái có thể hoàn escrow',
      );
    }

    return this.finalizeLocalRefund({
      bookingId,
      customerId: booking.customerId,
      paymentId: payment.id,
      refundAmount: payment.amount,
      reason,
      provider: 'INTERNAL',
      bookingAlreadyCancelled: false,
    });
  }

  private async refundMomoPayment(input: {
    bookingId: string;
    customerId: string;
    bookingStatus: BookingStatus;
    payment: {
      id: string;
      amount: number;
      status: PaymentStatus;
      transactionId: string | null;
      providerTransactionId: string | null;
      refundOrderId: string | null;
      refundRequestId: string | null;
    };
    reason: string;
  }) {
    const { payment } = input;
    if (!payment.transactionId) {
      throw new BadRequestException('MoMo payment thiếu merchant order id');
    }
    if (
      input.bookingStatus !== BookingStatus.CONFIRMED &&
      !(
        input.bookingStatus === BookingStatus.CANCELLED &&
        payment.refundOrderId &&
        payment.refundRequestId
      )
    ) {
      throw new BadRequestException(
        'Booking không còn ở trạng thái có thể bắt đầu/resume refund',
      );
    }

    const refundOrderId = `RF-${payment.id}`;
    const refundRequestId = `RFR-${payment.id}`;
    const resuming = Boolean(payment.refundOrderId || payment.refundRequestId);
    if (
      (payment.refundOrderId && payment.refundOrderId !== refundOrderId) ||
      (payment.refundRequestId && payment.refundRequestId !== refundRequestId)
    ) {
      throw new BadRequestException('Payment có refund intent không khớp');
    }

    await this.claimMomoRefundIntent(
      input.bookingId,
      payment.id,
      refundOrderId,
      refundRequestId,
      input.bookingStatus === BookingStatus.CONFIRMED,
    );

    const originalProviderTransId = await this.resolveOriginalMomoTransId(
      payment.id,
      payment.transactionId,
      payment.providerTransactionId,
      payment.amount,
    );

    if (resuming) {
      const previous = await this.momo.queryRefund(
        refundOrderId,
        refundRequestId,
      );
      const successful = previous.refundTrans?.find(
        (item) =>
          item.orderId === refundOrderId &&
          item.resultCode === 0 &&
          item.amount === payment.amount,
      );
      if (successful) {
        return this.finalizeLocalRefund({
          bookingId: input.bookingId,
          customerId: input.customerId,
          paymentId: payment.id,
          refundAmount: payment.amount,
          reason: input.reason,
          provider: 'MOMO',
          providerRefundTransactionId: successful.transId,
          providerResultCode: 0,
          bookingAlreadyCancelled: true,
        });
      }
    }

    const providerResult = await this.momo.refund({
      orderId: refundOrderId,
      requestId: refundRequestId,
      amount: payment.amount,
      transId: originalProviderTransId,
      description: input.reason,
    });

    await this.db.payment.updateMany({
      where: {
        id: payment.id,
        status: PaymentStatus.COMPLETED,
        OR: [
          { releasedAt: null },
          { releasedAt: { isSet: false } },
        ],
      },
      data: {
        refundResultCode: providerResult.resultCode,
        ...(providerResult.transId
          ? { refundProviderTransactionId: String(providerResult.transId) }
          : {}),
      },
    });

    if (providerResult.resultCode !== 0) {
      if (!MOMO_REFUND_PENDING_CODES.has(providerResult.resultCode)) {
        await this.restoreBookingAfterDefinitiveRefundFailure(
          input.bookingId,
          payment.id,
        );
      }
      throw new BadGatewayException(
        `MoMo chưa xác nhận refund (${providerResult.resultCode}): ${providerResult.message}`,
      );
    }

    return this.finalizeLocalRefund({
      bookingId: input.bookingId,
      customerId: input.customerId,
      paymentId: payment.id,
      refundAmount: payment.amount,
      reason: input.reason,
      provider: 'MOMO',
      providerRefundTransactionId: providerResult.transId,
      providerResultCode: providerResult.resultCode,
      bookingAlreadyCancelled: true,
    });
  }

  private async claimMomoRefundIntent(
    bookingId: string,
    paymentId: string,
    refundOrderId: string,
    refundRequestId: string,
    claimBooking: boolean,
  ) {
    await this.db.$transaction(async (tx) => {
      if (claimBooking) {
        const bookingClaim = await tx.booking.updateMany({
          where: {
            id: bookingId,
            status: BookingStatus.CONFIRMED,
            OR: [
              { trip: null },
              { trip: { is: { status: 'UPCOMING' } } },
            ],
          },
          data: { status: BookingStatus.CANCELLED },
        });
        if (bookingClaim.count !== 1) {
          throw new BadRequestException(
            'Booking vừa thay đổi; không thể bắt đầu refund',
          );
        }
      } else {
        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
          select: { status: true },
        });
        if (booking?.status !== BookingStatus.CANCELLED) {
          throw new BadRequestException(
            'Refund intent không còn giữ booking ở trạng thái CANCELLED',
          );
        }
      }

      const paymentClaim = await tx.payment.updateMany({
        where: {
          id: paymentId,
          status: PaymentStatus.COMPLETED,
          OR: [
            { releasedAt: null },
            { releasedAt: { isSet: false } },
          ],
        },
        data: { refundOrderId, refundRequestId },
      });
      if (paymentClaim.count !== 1) {
        throw new BadRequestException(
          'Payment vừa được xử lý hoặc không còn nằm trong escrow',
        );
      }
    });
  }

  private async resolveOriginalMomoTransId(
    paymentId: string,
    merchantOrderId: string,
    storedProviderTransactionId: string | null,
    amount: number,
  ) {
    const stored = this.parseProviderTransactionId(storedProviderTransactionId);
    if (stored) return stored;

    const status = await this.momo.queryStatus(
      merchantOrderId,
      `REFUND-PRECHECK-${paymentId}`,
    );
    if (![0, 9000].includes(status.resultCode)) {
      throw new BadGatewayException(
        `Không thể xác minh giao dịch gốc trên MoMo (${status.resultCode})`,
      );
    }
    if (status.amount !== undefined && status.amount !== amount) {
      throw new BadGatewayException('Số tiền giao dịch gốc trên MoMo không khớp');
    }
    const transId = this.parseProviderTransactionId(
      status.transId === undefined ? null : String(status.transId),
    );
    if (!transId) {
      throw new BadGatewayException('MoMo không trả provider transaction id hợp lệ');
    }

    await this.db.payment.updateMany({
      where: {
        id: paymentId,
        status: PaymentStatus.COMPLETED,
        OR: [
          { releasedAt: null },
          { releasedAt: { isSet: false } },
        ],
      },
      data: { providerTransactionId: String(transId) },
    });
    return transId;
  }

  private parseProviderTransactionId(value: string | null) {
    if (!value || !/^\d+$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }

  private async restoreBookingAfterDefinitiveRefundFailure(
    bookingId: string,
    paymentId: string,
  ) {
    await this.db.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        select: { status: true, releasedAt: true },
      });
      if (
        payment?.status !== PaymentStatus.COMPLETED ||
        payment.releasedAt
      ) {
        return;
      }
      await tx.booking.updateMany({
        where: { id: bookingId, status: BookingStatus.CANCELLED },
        data: { status: BookingStatus.CONFIRMED },
      });
    });
  }

  private async finalizeLocalRefund(input: {
    bookingId: string;
    customerId: string;
    paymentId: string;
    refundAmount: number;
    reason: string;
    provider: 'MOMO' | 'INTERNAL';
    providerRefundTransactionId?: number;
    providerResultCode?: number;
    bookingAlreadyCancelled: boolean;
  }) {
    const result = await this.db.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: input.paymentId },
      });
      if (!payment) throw new NotFoundException('Payment không tồn tại');
      if (payment.status === PaymentStatus.REFUNDED) {
        return {
          success: true,
          refundAmount: input.refundAmount,
          message: 'Payment đã được hoàn trước đó',
        };
      }
      if (payment.status !== PaymentStatus.COMPLETED) {
        throw new BadRequestException('Payment không còn có thể hoàn tiền');
      }
      if (payment.releasedAt) {
        throw new BadRequestException(
          'Payment đã được giải ngân; không thể debit escrow để refund',
        );
      }

      if (!input.bookingAlreadyCancelled) {
        const bookingClaim = await tx.booking.updateMany({
          where: {
            id: input.bookingId,
            status: BookingStatus.CONFIRMED,
            OR: [
              { trip: null },
              { trip: { is: { status: 'UPCOMING' } } },
            ],
          },
          data: { status: BookingStatus.CANCELLED },
        });
        if (bookingClaim.count !== 1) {
          throw new BadRequestException(
            'Booking vừa được release, hủy hoặc bắt đầu chuyến đi',
          );
        }
      } else {
        const booking = await tx.booking.findUnique({
          where: { id: input.bookingId },
          select: { status: true },
        });
        if (booking?.status !== BookingStatus.CANCELLED) {
          throw new BadRequestException(
            'Booking refund intent không còn ở trạng thái CANCELLED',
          );
        }
      }

      const bookingPromotion = await tx.booking.findUnique({
        where: { id: input.bookingId },
        select: { promotionId: true },
      });
      if (!bookingPromotion) {
        throw new NotFoundException('Booking không tồn tại');
      }

      const paymentClaim = await tx.payment.updateMany({
        where: {
          id: input.paymentId,
          status: PaymentStatus.COMPLETED,
          OR: [
            { releasedAt: null },
            { releasedAt: { isSet: false } },
          ],
        },
        data: {
          status: PaymentStatus.REFUNDED,
          refundedAt: new Date(),
          failureReason: `Refund 100%: ${input.reason}`.slice(0, 500),
          ...(input.providerRefundTransactionId
            ? {
                refundProviderTransactionId: String(
                  input.providerRefundTransactionId,
                ),
              }
            : {}),
          ...(input.providerResultCode !== undefined
            ? { refundResultCode: input.providerResultCode }
            : {}),
        },
      });
      if (paymentClaim.count !== 1) {
        throw new BadRequestException(
          'Giao dịch đã được xử lý hoặc không còn nằm trong escrow',
        );
      }

      if (bookingPromotion.promotionId) {
        await tx.promotion.updateMany({
          where: {
            id: bookingPromotion.promotionId,
            usedCount: { gt: 0 },
          },
          data: { usedCount: { decrement: 1 } },
        });
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
          balance: { gte: input.refundAmount },
        },
        data: { balance: { decrement: input.refundAmount } },
      });
      if (escrowDebit.count !== 1) {
        throw new BadRequestException('Số dư escrow không đủ để hoàn tiền');
      }

      const customerWallet = await tx.wallet.upsert({
        where: { userId: input.customerId },
        create: {
          userId: input.customerId,
          balance: input.refundAmount,
          currency: 'VND',
        },
        update: { balance: { increment: input.refundAmount } },
      });
      await tx.walletTransaction.createMany({
        data: [
          {
            walletId: platformWallet.id,
            amount: -input.refundAmount,
            type: 'ESCROW_REFUND',
            description: `Hoàn escrow booking ${input.bookingId}: ${input.reason}`,
            metadata: {
              operation: 'ADMIN_REFUND',
              provider: input.provider,
              bookingId: input.bookingId,
              paymentId: input.paymentId,
              counterpartWalletId: customerWallet.id,
              providerRefundTransactionId:
                input.providerRefundTransactionId,
            },
          },
          {
            walletId: customerWallet.id,
            amount: input.refundAmount,
            type: 'REFUND',
            description: `Hoàn tiền booking ${input.bookingId}: ${input.reason}`,
            metadata: {
              operation: 'ADMIN_REFUND',
              provider: input.provider,
              bookingId: input.bookingId,
              paymentId: input.paymentId,
              percent: 100,
              counterpartWalletId: platformWallet.id,
              providerRefundTransactionId:
                input.providerRefundTransactionId,
            },
          },
        ],
      });

      await tx.trip.deleteMany({
        where: { bookingId: input.bookingId, status: 'UPCOMING' },
      });

      return {
        success: true,
        refundAmount: input.refundAmount,
        message:
          input.provider === 'MOMO'
            ? 'MoMo đã xác nhận refund; ví khách hàng đã được đối soát'
            : 'Đã hoàn tiền vào ví khách hàng',
      };
    });

    this.logger.warn(
      `Refunded booking ${input.bookingId} via ${input.provider}`,
    );
    return result;
  }
}
