import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MomoIpnDto } from './dto/momo.dto';
import { MomoGatewayService } from './momo-gateway.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly platformUserId: string;

  constructor(
    private readonly db: PrismaService,
    private readonly momo: MomoGatewayService,
    config: ConfigService,
  ) {
    this.platformUserId = config.getOrThrow<string>('PLATFORM_USER_ID');
  }

  async createMomoCheckout(userId: string, paymentId: string) {
    const payment = await this.getOwnedPayment(userId, paymentId);
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Payment không còn ở trạng thái chờ thanh toán');
    }
    if (payment.paymentMethod.toUpperCase() !== 'MOMO') {
      throw new BadRequestException('Payment này không sử dụng phương thức MoMo');
    }
    if (!payment.transactionId) {
      throw new BadRequestException('Payment thiếu merchant order id');
    }

    const requestId = this.checkoutRequestId(payment.id);
    const result = await this.momo.createCheckout({
      orderId: payment.transactionId,
      requestId,
      amount: payment.amount,
      orderInfo: `Elite Drive booking ${payment.bookingId ?? payment.id}`,
      returnReference: payment.id,
      extraData: {
        paymentId: payment.id,
        ...(payment.bookingId ? { bookingId: payment.bookingId } : {}),
      },
    });

    return {
      paymentId: payment.id,
      orderId: result.orderId,
      requestId: result.requestId,
      amount: result.amount,
      payUrl: result.payUrl,
      shortLink: result.shortLink,
      provider: 'MOMO',
      environment: 'sandbox',
    };
  }

  async queryMomoStatus(userId: string, paymentId: string) {
    const payment = await this.getOwnedPayment(userId, paymentId);
    if (!payment.transactionId) {
      throw new BadRequestException('Payment thiếu merchant order id');
    }

    const result = await this.momo.queryStatus(
      payment.transactionId,
      `QUERY-${payment.id}`,
    );

    if (result.resultCode === 0 && payment.status === PaymentStatus.PENDING) {
      await this.completePayment(payment.id, result.transId);
    }

    return {
      paymentId: payment.id,
      localStatus:
        result.resultCode === 0 ? PaymentStatus.COMPLETED : payment.status,
      providerResultCode: result.resultCode,
      providerMessage: result.message,
      providerTransactionId: result.transId,
    };
  }

  async handleMomoIpn(payload: MomoIpnDto) {
    if (!this.momo.verifyIpn(payload)) {
      throw new UnauthorizedException('Chữ ký MoMo không hợp lệ');
    }

    const payment = await this.db.payment.findFirst({
      where: { transactionId: payload.orderId },
    });
    if (!payment) {
      throw new NotFoundException('Không tìm thấy payment tương ứng MoMo order');
    }

    if (
      payment.transactionId !== payload.orderId ||
      payment.amount !== payload.amount ||
      payload.requestId !== this.checkoutRequestId(payment.id)
    ) {
      throw new BadRequestException('MoMo notification không khớp payment');
    }

    if (payload.resultCode === 0) {
      if (payment.status === PaymentStatus.PENDING) {
        await this.completePayment(payment.id, payload.transId);
      }
      this.logger.log(`Accepted MoMo IPN for payment ${payment.id}`);
      return;
    }

    this.logger.warn(
      `MoMo payment ${payment.id} resultCode=${payload.resultCode}: ${payload.message}`,
    );
  }

  private checkoutRequestId(paymentId: string) {
    return `REQ-${paymentId}`;
  }

  private async getOwnedPayment(userId: string, paymentId: string) {
    const payment = await this.db.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment không tồn tại');
    if (payment.userId !== userId) {
      throw new ForbiddenException('Payment không thuộc tài khoản hiện tại');
    }
    return payment;
  }

  private async completePayment(paymentId: string, providerTransactionId?: number) {
    return this.db.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { booking: true },
      });
      if (!payment || !payment.booking) {
        throw new NotFoundException('Payment hoặc booking không tồn tại');
      }

      if (payment.status === PaymentStatus.COMPLETED) return payment;

      const paymentClaim = await tx.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.COMPLETED, paidAt: new Date() },
      });
      if (paymentClaim.count !== 1) {
        throw new BadRequestException('Payment đã được xử lý');
      }

      const bookingClaim = await tx.booking.updateMany({
        where: {
          id: payment.booking.id,
          status: BookingStatus.APPROVED,
        },
        data: { status: BookingStatus.CONFIRMED },
      });
      if (bookingClaim.count !== 1) {
        throw new BadRequestException('Booking không còn có thể xác nhận thanh toán');
      }

      const platformWallet = await tx.wallet.upsert({
        where: { userId: this.platformUserId },
        create: {
          userId: this.platformUserId,
          balance: payment.amount,
          currency: 'VND',
        },
        update: { balance: { increment: payment.amount } },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: platformWallet.id,
          amount: payment.amount,
          type: 'ESCROW_HELD',
          description: `Giữ tiền cho booking ${payment.booking.id}`,
          metadata: {
            operation: 'PAYMENT_CONFIRMED',
            provider: 'MOMO',
            providerTransactionId,
            bookingId: payment.booking.id,
            paymentId: payment.id,
          },
        },
      });

      await tx.trip.upsert({
        where: { bookingId: payment.booking.id },
        update: {},
        create: {
          bookingId: payment.booking.id,
          customerId: payment.booking.customerId,
          carId: payment.booking.carId,
          status: 'UPCOMING',
        },
      });

      return tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
    });
  }
}
