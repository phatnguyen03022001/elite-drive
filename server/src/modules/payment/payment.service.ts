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
import { assertVndAmount } from '../../common/money/vnd';
import { buildRentalContractContent } from '../../common/rental/contract';
import { PrismaService } from '../../prisma/prisma.service';
import { MomoIpnDto } from './dto/momo.dto';
import { MomoGatewayService } from './momo-gateway.service';

const MOMO_SUCCESS_CODES = new Set([0, 9000]);
const MOMO_FINAL_FAILURE_CODES = new Set([
  98, 99, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1017, 1026, 2019,
  4001, 4002, 4100,
]);

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
    assertVndAmount(payment.amount, { min: 1000, field: 'Số tiền MoMo' });

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
    assertVndAmount(payment.amount, { min: 1000, field: 'Số tiền MoMo' });

    const result = await this.momo.queryStatus(
      payment.transactionId,
      `QUERY-${payment.id}`,
    );
    this.assertProviderAmount(payment.amount, result.amount);

    const localStatus = await this.applyProviderResult(
      payment.id,
      result.resultCode,
      result.message,
      result.transId,
    );

    return {
      paymentId: payment.id,
      localStatus,
      providerResultCode: result.resultCode,
      providerMessage: result.message,
      providerTransactionId: result.transId,
    };
  }

  async reconcilePendingMomoPayments(limit = 50) {
    if (!this.momo.isEnabled()) {
      throw new BadRequestException('MoMo sandbox chưa được bật');
    }

    const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
    const cutoff = new Date(Date.now() - 2 * 60 * 1000);
    const payments = await this.db.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        paymentMethod: 'MOMO',
        transactionId: { not: null },
        createdAt: { lte: cutoff },
      },
      orderBy: { createdAt: 'asc' },
      take: safeLimit,
    });

    const summary = {
      checked: 0,
      completed: 0,
      failed: 0,
      pending: 0,
      providerErrors: 0,
    };

    for (const payment of payments) {
      if (!payment.transactionId) continue;
      summary.checked += 1;
      try {
        assertVndAmount(payment.amount, { min: 1000, field: 'Số tiền MoMo' });
        const result = await this.momo.queryStatus(
          payment.transactionId,
          `RECON-${payment.id}`,
        );
        this.assertProviderAmount(payment.amount, result.amount);
        const status = await this.applyProviderResult(
          payment.id,
          result.resultCode,
          result.message,
          result.transId,
        );
        if (status === PaymentStatus.COMPLETED) summary.completed += 1;
        else if (status === PaymentStatus.FAILED) summary.failed += 1;
        else summary.pending += 1;
      } catch (error) {
        summary.providerErrors += 1;
        this.logger.warn(
          `MoMo reconciliation failed for payment ${payment.id}: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }
    }

    return summary;
  }

  async handleMomoIpn(payload: MomoIpnDto) {
    if (!this.momo.verifyIpn(payload)) {
      throw new UnauthorizedException('Chữ ký MoMo không hợp lệ');
    }
    assertVndAmount(payload.amount, { min: 1000, field: 'Số tiền MoMo IPN' });

    const payment = await this.db.payment.findFirst({
      where: { transactionId: payload.orderId },
    });
    if (!payment) {
      throw new NotFoundException('Không tìm thấy payment tương ứng MoMo order');
    }
    assertVndAmount(payment.amount, { min: 1000, field: 'Số tiền payment' });

    if (
      payment.transactionId !== payload.orderId ||
      payment.amount !== payload.amount ||
      payload.requestId !== this.checkoutRequestId(payment.id)
    ) {
      throw new BadRequestException('MoMo notification không khớp payment');
    }

    await this.applyProviderResult(
      payment.id,
      payload.resultCode,
      payload.message,
      payload.transId,
    );
    this.logger.log(
      `Accepted MoMo IPN for payment ${payment.id}, resultCode=${payload.resultCode}`,
    );
  }

  private async applyProviderResult(
    paymentId: string,
    resultCode: number,
    providerMessage: string,
    providerTransactionId?: number,
  ): Promise<PaymentStatus> {
    const latest = await this.db.payment.findUnique({
      where: { id: paymentId },
      select: { status: true, providerTransactionId: true },
    });
    if (!latest) throw new NotFoundException('Payment không tồn tại');

    const currentStatus = latest.status;
    if (MOMO_SUCCESS_CODES.has(resultCode)) {
      if (currentStatus === PaymentStatus.PENDING) {
        await this.completePayment(paymentId, providerTransactionId);
        return PaymentStatus.COMPLETED;
      }
      if (currentStatus === PaymentStatus.COMPLETED) {
        if (
          !latest.providerTransactionId &&
          this.isValidProviderTransactionId(providerTransactionId)
        ) {
          await this.db.payment.updateMany({
            where: {
              id: paymentId,
              status: PaymentStatus.COMPLETED,
              OR: [
                { providerTransactionId: null },
                { providerTransactionId: { isSet: false } },
              ],
            },
            data: { providerTransactionId: String(providerTransactionId) },
          });
        }
        return PaymentStatus.COMPLETED;
      }

      this.logger.warn(
        `MoMo success conflicts with local terminal status ${currentStatus} for payment ${paymentId}`,
      );
      return currentStatus;
    }

    if (
      currentStatus === PaymentStatus.PENDING &&
      MOMO_FINAL_FAILURE_CODES.has(resultCode)
    ) {
      const updated = await this.db.payment.updateMany({
        where: { id: paymentId, status: PaymentStatus.PENDING },
        data: {
          status: PaymentStatus.FAILED,
          failureReason: `MOMO_${resultCode}: ${providerMessage}`.slice(0, 500),
        },
      });
      if (updated.count === 1) {
        this.logger.warn(`MoMo payment ${paymentId} marked FAILED (${resultCode})`);
        return PaymentStatus.FAILED;
      }
      const raced = await this.db.payment.findUnique({
        where: { id: paymentId },
        select: { status: true },
      });
      return raced?.status ?? currentStatus;
    }

    return currentStatus;
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

  private assertProviderAmount(localAmount: number, providerAmount?: number) {
    if (providerAmount === undefined) return;
    assertVndAmount(providerAmount, { min: 1000, field: 'Số tiền MoMo response' });
    if (providerAmount !== localAmount) {
      throw new BadRequestException('Số tiền MoMo không khớp payment local');
    }
  }

  private isValidProviderTransactionId(value?: number): value is number {
    return Number.isSafeInteger(value) && Number(value) > 0;
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
      assertVndAmount(payment.amount, { min: 1000, field: 'Số tiền payment' });
      assertVndAmount(payment.booking.totalPrice, {
        min: 1000,
        field: 'Tổng tiền booking',
      });
      if (payment.amount !== payment.booking.totalPrice) {
        throw new BadRequestException(
          'Số tiền payment không khớp tổng tiền booking',
        );
      }

      if (payment.status === PaymentStatus.COMPLETED) return payment;

      const paymentClaim = await tx.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: {
          status: PaymentStatus.COMPLETED,
          paidAt: new Date(),
          ...(this.isValidProviderTransactionId(providerTransactionId)
            ? { providerTransactionId: String(providerTransactionId) }
            : {}),
        },
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

      await tx.contract.upsert({
        where: { bookingId: payment.booking.id },
        update: {},
        create: {
          bookingId: payment.booking.id,
          content: buildRentalContractContent(payment.booking),
          status: 'DRAFT',
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
