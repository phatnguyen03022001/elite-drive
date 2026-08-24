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
import { paymentMatchesBookingAmount } from '../../common/rental/lifecycle-policy';
import { PrismaService } from '../../prisma/prisma.service';
import { MomoIpnDto } from './dto/momo.dto';
import { MomoGatewayService } from './momo-gateway.service';

const MOMO_SUCCESS_CODES = new Set([0, 9000]);
const MOMO_FINAL_FAILURE_CODES = new Set([
  98, 99, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1017, 1026, 2019,
  4001, 4002, 4100,
]);
const MOMO_REFUND_PENDING_CODES = new Set([1000, 7000, 7002]);

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

  async listOpenMomoProviderSuccessConflicts(limit = 50) {
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
    return this.db.payment.findMany({
      where: {
        paymentMethod: 'MOMO',
        status: PaymentStatus.FAILED,
        providerSuccessConflictAt: { not: null },
      },
      orderBy: { providerSuccessConflictAt: 'asc' },
      take: safeLimit,
      select: {
        id: true,
        bookingId: true,
        amount: true,
        status: true,
        transactionId: true,
        providerTransactionId: true,
        failureReason: true,
        providerSuccessResultCode: true,
        providerSuccessConflictAt: true,
        refundOrderId: true,
        refundRequestId: true,
        refundProviderTransactionId: true,
        refundResultCode: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async recoverMomoProviderSuccessConflict(paymentId: string) {
    const payment = await this.db.payment.findUnique({
      where: { id: paymentId },
      include: { booking: { include: { trip: true } } },
    });
    if (!payment || payment.paymentMethod.toUpperCase() !== 'MOMO') {
      throw new NotFoundException('MoMo conflict payment không tồn tại');
    }
    if (payment.status === PaymentStatus.COMPLETED) {
      return { paymentId, disposition: 'COMPLETED', localStatus: payment.status };
    }
    if (payment.status === PaymentStatus.REFUNDED) {
      return { paymentId, disposition: 'REFUNDED', localStatus: payment.status };
    }
    if (payment.status !== PaymentStatus.FAILED || !payment.providerSuccessConflictAt) {
      return { paymentId, disposition: 'QUARANTINED', localStatus: payment.status };
    }
    if (!payment.transactionId || !payment.booking) {
      return { paymentId, disposition: 'QUARANTINED', localStatus: payment.status };
    }

    const verified = await this.momo.queryStatus(
      payment.transactionId,
      `RECOVER-QUERY-${payment.id}`,
    );
    if (
      !MOMO_SUCCESS_CODES.has(verified.resultCode) ||
      verified.amount !== payment.amount ||
      !this.isValidProviderTransactionId(verified.transId) ||
      (payment.providerTransactionId !== null &&
        payment.providerTransactionId !== String(verified.transId))
    ) {
      return { paymentId, disposition: 'QUARANTINED', localStatus: payment.status };
    }

    const verifiedProviderTransactionId = String(verified.transId);
    if (!payment.providerTransactionId) {
      await this.db.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.FAILED },
        data: { providerTransactionId: verifiedProviderTransactionId },
      });
    }

    const siblings = payment.bookingId
      ? await this.db.payment.findMany({
          where: { bookingId: payment.bookingId, id: { not: payment.id } },
          select: { id: true, status: true, createdAt: true },
        })
      : [];
    const hasCompetingSibling = siblings.some(
      (sibling) =>
        sibling.status === PaymentStatus.COMPLETED ||
        sibling.createdAt > payment.createdAt,
    );
    const tripStarted = payment.booking.trip
      ? payment.booking.trip.status !== 'UPCOMING'
      : false;
    if (
      payment.booking.status === BookingStatus.APPROVED &&
      !tripStarted &&
      !hasCompetingSibling &&
      !payment.refundOrderId &&
      !payment.refundRequestId
    ) {
      try {
        await this.completePayment(
          payment.id,
          verified.transId,
          [PaymentStatus.FAILED],
        );
        return {
          paymentId,
          disposition: 'COMPLETED',
          localStatus: PaymentStatus.COMPLETED,
        };
      } catch (error) {
        this.logger.warn(
          `MoMo conflict completion quarantined for payment ${payment.id}: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
        return { paymentId, disposition: 'QUARANTINED', localStatus: PaymentStatus.FAILED };
      }
    }

    return this.refundProviderSuccessConflict(payment, verifiedProviderTransactionId);
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
      select: {
        status: true,
        providerTransactionId: true,
        providerSuccessConflictAt: true,
      },
    });
    if (!latest) throw new NotFoundException('Payment không tồn tại');

    const currentStatus = latest.status;
    if (MOMO_SUCCESS_CODES.has(resultCode)) {
      if (currentStatus === PaymentStatus.PENDING) {
        try {
          await this.completePayment(paymentId, providerTransactionId);
          return PaymentStatus.COMPLETED;
        } catch (error) {
          const conflict = await this.recordProviderSuccessConflict(
            paymentId,
            resultCode,
            providerTransactionId,
            error instanceof Error ? error.message : 'local completion conflict',
          );
          if (conflict) return PaymentStatus.FAILED;
          const raced = await this.db.payment.findUnique({
            where: { id: paymentId },
            select: { status: true },
          });
          return raced?.status ?? currentStatus;
        }
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

      if (currentStatus === PaymentStatus.FAILED) {
        if (this.isValidProviderTransactionId(providerTransactionId)) {
          const incomingProviderTransactionId = String(providerTransactionId);
          if (!latest.providerTransactionId) {
            await this.db.payment.updateMany({
              where: {
                id: paymentId,
                status: PaymentStatus.FAILED,
                OR: [
                  { providerTransactionId: null },
                  { providerTransactionId: { isSet: false } },
                ],
              },
              data: { providerTransactionId: incomingProviderTransactionId },
            });
          } else if (latest.providerTransactionId !== incomingProviderTransactionId) {
            this.logger.warn(
              `MoMo provider identity conflict for payment ${paymentId}: existing=${latest.providerTransactionId}, incoming=${incomingProviderTransactionId}`,
            );
          }
        }

        if (!latest.providerSuccessConflictAt) {
          await this.db.payment.updateMany({
            where: {
              id: paymentId,
              status: PaymentStatus.FAILED,
              OR: [
                { providerSuccessConflictAt: null },
                { providerSuccessConflictAt: { isSet: false } },
              ],
            },
            data: {
              providerSuccessConflictAt: new Date(),
              providerSuccessResultCode: resultCode,
            },
          });
        }
        return PaymentStatus.FAILED;
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

  private async completePayment(
    paymentId: string,
    providerTransactionId?: number,
    expectedStatuses: PaymentStatus[] = [PaymentStatus.PENDING],
  ) {
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
      if (!paymentMatchesBookingAmount(payment.amount, payment.booking.totalPrice)) {
        throw new BadRequestException(
          'Số tiền payment không khớp tổng tiền booking',
        );
      }

      if (payment.status === PaymentStatus.COMPLETED) return payment;

      if (payment.bookingId && expectedStatuses.includes(PaymentStatus.FAILED)) {
        const competing = await tx.payment.findMany({
          where: { bookingId: payment.bookingId, id: { not: payment.id } },
          select: { status: true, createdAt: true },
        });
        if (competing.some(
          (sibling) =>
            sibling.status === PaymentStatus.COMPLETED ||
            sibling.createdAt > payment.createdAt,
        )) {
          throw new BadRequestException('Payment không còn là attempt hợp lệ');
        }
      }

      const paymentClaim = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: { in: expectedStatuses },
          OR: [
            { refundOrderId: null, refundRequestId: null },
            { refundOrderId: { isSet: false }, refundRequestId: { isSet: false } },
          ],
          ...(this.isValidProviderTransactionId(providerTransactionId)
            ? {
                AND: [
                  {
                    OR: [
                      { providerTransactionId: null },
                      { providerTransactionId: { isSet: false } },
                      { providerTransactionId: String(providerTransactionId) },
                    ],
                  },
                ],
              }
            : {}),
        },
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

  private async recordProviderSuccessConflict(
    paymentId: string,
    resultCode: number,
    providerTransactionId: number | undefined,
    reason: string,
  ) {
    const conflictData = {
      status: PaymentStatus.FAILED,
      providerSuccessConflictAt: new Date(),
      providerSuccessResultCode: resultCode,
      failureReason: `MOMO provider success local conflict: ${reason}`.slice(0, 500),
    };
    const withIdentity = this.isValidProviderTransactionId(providerTransactionId)
      ? await this.db.payment.updateMany({
          where: {
            id: paymentId,
            status: PaymentStatus.PENDING,
            OR: [
              { providerTransactionId: null },
              { providerTransactionId: { isSet: false } },
            ],
          },
          data: {
            ...conflictData,
            providerTransactionId: String(providerTransactionId),
          },
        })
      : { count: 0 };
    if (withIdentity.count === 1) return true;
    const updated = await this.db.payment.updateMany({
      where: { id: paymentId, status: PaymentStatus.PENDING },
      data: conflictData,
    });
    return updated.count === 1;
  }

  private async refundProviderSuccessConflict(
    payment: {
      id: string;
      amount: number;
      transactionId: string | null;
      providerTransactionId: string | null;
      refundOrderId: string | null;
      refundRequestId: string | null;
      bookingId: string | null;
    },
    providerTransactionId: string,
  ) {
    const refundOrderId = `RF-${payment.id}`;
    const refundRequestId = `RFR-${payment.id}`;
    if (
      (payment.refundOrderId && payment.refundOrderId !== refundOrderId) ||
      (payment.refundRequestId && payment.refundRequestId !== refundRequestId)
    ) {
      return { paymentId: payment.id, disposition: 'QUARANTINED', localStatus: PaymentStatus.FAILED };
    }
    let resuming = Boolean(payment.refundOrderId || payment.refundRequestId);
    if (!resuming) {
      const intentClaim = await this.db.payment.updateMany({
        where: {
          id: payment.id,
          status: PaymentStatus.FAILED,
          providerSuccessConflictAt: { not: null },
          refundOrderId: null,
          refundRequestId: null,
        },
        data: { refundOrderId, refundRequestId },
      });
      if (intentClaim.count !== 1) {
        resuming = true;
        const current = await this.db.payment.findUnique({
          where: { id: payment.id },
          select: {
            status: true,
            refundOrderId: true,
            refundRequestId: true,
          },
        });
        if (current?.status === PaymentStatus.COMPLETED) {
          return { paymentId: payment.id, disposition: 'COMPLETED', localStatus: current.status };
        }
        if (current?.status === PaymentStatus.REFUNDED) {
          return { paymentId: payment.id, disposition: 'REFUNDED', localStatus: current.status };
        }
        if (
          current?.status !== PaymentStatus.FAILED ||
          current.refundOrderId !== refundOrderId ||
          current.refundRequestId !== refundRequestId
        ) {
          return { paymentId: payment.id, disposition: 'QUARANTINED', localStatus: current?.status ?? PaymentStatus.FAILED };
        }
      }
    }
    if (resuming) {
      let previous;
      try {
        previous = await this.momo.queryRefund(refundOrderId, refundRequestId);
      } catch (error) {
        this.logger.warn(
          `MoMo conflict refund query quarantined for payment ${payment.id}: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
        return { paymentId: payment.id, disposition: 'QUARANTINED', localStatus: PaymentStatus.FAILED };
      }
      const successful = previous.refundTrans?.find(
        (item) =>
          item.orderId === refundOrderId &&
          item.amount === payment.amount &&
          item.resultCode === 0 &&
          this.isValidProviderTransactionId(item.transId),
      );
      if (successful) {
        await this.finalizeProviderSuccessConflictRefund(
          payment.id,
          refundOrderId,
          refundRequestId,
          successful.transId!,
          0,
        );
        return { paymentId: payment.id, disposition: 'REFUNDED', localStatus: PaymentStatus.REFUNDED };
      }
      if (MOMO_REFUND_PENDING_CODES.has(previous.resultCode)) {
        return { paymentId: payment.id, disposition: 'REFUND_PENDING', localStatus: PaymentStatus.FAILED };
      }
      return { paymentId: payment.id, disposition: 'QUARANTINED', localStatus: PaymentStatus.FAILED };
    }

    let result;
    try {
      result = await this.momo.refund({
        orderId: refundOrderId,
        requestId: refundRequestId,
        amount: payment.amount,
        transId: Number(providerTransactionId),
        description: `Refund MoMo provider-success conflict ${payment.id}`,
      });
    } catch (error) {
      this.logger.warn(
        `MoMo conflict refund quarantined for payment ${payment.id}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return { paymentId: payment.id, disposition: 'QUARANTINED', localStatus: PaymentStatus.FAILED };
    }
    await this.db.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.FAILED },
      data: {
        refundResultCode: result.resultCode,
        ...(this.isValidProviderTransactionId(result.transId)
          ? { refundProviderTransactionId: String(result.transId) }
          : {}),
        ...(result.resultCode !== 0
          ? { failureReason: `MOMO conflict refund ${result.resultCode}: ${result.message}`.slice(0, 500) }
          : {}),
      },
    });
    if (result.resultCode !== 0) {
      return {
        paymentId: payment.id,
        disposition: MOMO_REFUND_PENDING_CODES.has(result.resultCode)
          ? 'REFUND_PENDING'
          : 'QUARANTINED',
        localStatus: PaymentStatus.FAILED,
      };
    }
    if (!this.isValidProviderTransactionId(result.transId)) {
      return { paymentId: payment.id, disposition: 'QUARANTINED', localStatus: PaymentStatus.FAILED };
    }
    const finalized = await this.finalizeProviderSuccessConflictRefund(
      payment.id,
      refundOrderId,
      refundRequestId,
      result.transId,
      result.resultCode,
    );
    return finalized
      ? { paymentId: payment.id, disposition: 'REFUNDED', localStatus: PaymentStatus.REFUNDED }
      : { paymentId: payment.id, disposition: 'QUARANTINED', localStatus: PaymentStatus.FAILED };
  }

  private async finalizeProviderSuccessConflictRefund(
    paymentId: string,
    refundOrderId: string,
    refundRequestId: string,
    refundProviderTransactionId: number,
    refundResultCode: number,
  ) {
    const updated = await this.db.payment.updateMany({
      where: {
        id: paymentId,
        status: PaymentStatus.FAILED,
        refundOrderId,
        refundRequestId,
      },
      data: {
        status: PaymentStatus.REFUNDED,
        refundedAt: new Date(),
        refundProviderTransactionId: String(refundProviderTransactionId),
        refundResultCode,
      },
    });
    return updated.count === 1;
  }
}
