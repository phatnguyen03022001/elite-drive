import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, PaymentStatus, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { assertVndAmount } from '../../common/money/vnd';
import { buildRentalContractContent } from '../../common/rental/contract';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConfirmPaymentDto,
  CreatePaymentDto,
  CreateWalletTopupDto,
} from './dto/customer.dto';

@Injectable()
export class CustomerPaymentService {
  private readonly logger = new Logger(CustomerPaymentService.name);
  private readonly platformUserId: string;
  private readonly mockPaymentsEnabled: boolean;

  constructor(
    private readonly db: PrismaService,
    config: ConfigService,
  ) {
    this.platformUserId = config.getOrThrow<string>('PLATFORM_USER_ID');
    this.mockPaymentsEnabled =
      config.get<string>('MOCK_PAYMENTS_ENABLED') === 'true' &&
      config.get<string>('NODE_ENV') !== 'production';
  }

  isMockPaymentsEnabled() {
    return this.mockPaymentsEnabled;
  }

  async createPayment(userId: string, dto: CreatePaymentDto) {
    const booking = await this.db.booking.findUnique({
      where: { id: dto.bookingId },
    });
    if (!booking) throw new NotFoundException('Không tìm thấy booking');
    if (booking.customerId !== userId) {
      throw new ForbiddenException('Booking không thuộc tài khoản hiện tại');
    }
    if (booking.status !== BookingStatus.APPROVED) {
      throw new BadRequestException(
        'Booking phải ở trạng thái APPROVED mới có thể thanh toán',
      );
    }
    assertVndAmount(booking.totalPrice, { field: 'Tổng tiền booking' });

    const paymentMethod = dto.paymentMethod.toUpperCase();
    if (!['MOCK_QR', 'MOMO'].includes(paymentMethod)) {
      throw new BadRequestException('Phương thức thanh toán chưa được hỗ trợ');
    }
    if (paymentMethod === 'MOCK_QR') this.assertMockPaymentsEnabled();

    const latest = await this.db.payment.findFirst({
      where: { bookingId: booking.id, userId },
      orderBy: { createdAt: 'desc' },
    });

    if (latest) {
      assertVndAmount(latest.amount, { field: 'Số tiền payment' });
      if (latest.amount !== booking.totalPrice) {
        throw new BadRequestException(
          'Payment hiện tại không khớp tổng tiền booking',
        );
      }

      if (latest.status === PaymentStatus.PENDING) {
        if (latest.paymentMethod !== paymentMethod) {
          throw new BadRequestException(
            'Booking đang có payment chờ xử lý bằng phương thức khác',
          );
        }
        return latest;
      }

      if (latest.status === PaymentStatus.COMPLETED) {
        return latest;
      }

      if (latest.status === PaymentStatus.REFUNDED) {
        throw new BadRequestException(
          'Payment của booking đã được hoàn tiền; không thể tạo lại',
        );
      }
    }

    const paymentId = latest?.status === PaymentStatus.FAILED
      ? this.paymentAttemptId(`retry:${latest.id}`)
      : this.paymentAttemptId(`initial:${booking.id}:${userId}`);
    const merchantOrderId = this.merchantOrderId(paymentId);

    try {
      return await this.db.payment.create({
        data: {
          id: paymentId,
          bookingId: booking.id,
          userId,
          amount: booking.totalPrice,
          paymentMethod,
          status: PaymentStatus.PENDING,
          transactionId: merchantOrderId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replay = await this.db.payment.findUnique({
          where: { id: paymentId },
        });
        if (
          replay &&
          replay.bookingId === booking.id &&
          replay.userId === userId &&
          replay.amount === booking.totalPrice &&
          replay.paymentMethod === paymentMethod &&
          replay.status === PaymentStatus.PENDING
        ) {
          return replay;
        }
      }
      throw error;
    }
  }

  async confirmMockPaymentByQr(paymentId: string) {
    this.assertMockPaymentsEnabled();
    return this.completeBookingPayment(paymentId, 'MOCK_QR');
  }

  async confirmMockPayment(userId: string, dto: ConfirmPaymentDto) {
    this.assertMockPaymentsEnabled();
    const payment = await this.db.payment.findFirst({
      where: {
        bookingId: dto.bookingId,
        userId,
        status: PaymentStatus.PENDING,
        paymentMethod: 'MOCK_QR',
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) {
      throw new NotFoundException('Không tìm thấy yêu cầu thanh toán mock');
    }
    if (payment.transactionId !== dto.transactionId) {
      throw new BadRequestException('Transaction ID không khớp');
    }
    return this.completeBookingPayment(payment.id, 'MOCK_QR');
  }

  async createWalletTopup(userId: string, dto: CreateWalletTopupDto) {
    assertVndAmount(dto.amount, { min: 1000, field: 'Số tiền nạp' });
    const paymentMethod = dto.paymentMethod.toUpperCase();
    if (paymentMethod !== 'MOCK_QR') {
      throw new BadRequestException(
        'Wallet top-up hiện chỉ hỗ trợ MOCK_QR; MoMo sẽ dùng payment gateway flow riêng',
      );
    }
    this.assertMockPaymentsEnabled();

    await this.db.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    return this.db.payment.create({
      data: {
        userId,
        amount: dto.amount,
        paymentMethod,
        status: PaymentStatus.PENDING,
        transactionId: `TOPUP-${randomUUID()}`,
      },
    });
  }

  async confirmMockWalletTopup(paymentId: string) {
    this.assertMockPaymentsEnabled();

    const result = await this.db.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (
        !payment ||
        payment.bookingId !== null ||
        payment.paymentMethod !== 'MOCK_QR' ||
        !payment.transactionId?.startsWith('TOPUP-')
      ) {
        throw new BadRequestException('Giao dịch top-up không hợp lệ');
      }
      assertVndAmount(payment.amount, { field: 'Số tiền top-up' });

      const claim = await tx.payment.updateMany({
        where: {
          id: paymentId,
          status: PaymentStatus.PENDING,
          paymentMethod: 'MOCK_QR',
          OR: [
            { bookingId: null },
            { bookingId: { isSet: false } },
          ],
        },
        data: { status: PaymentStatus.COMPLETED, paidAt: new Date() },
      });
      if (claim.count !== 1) {
        throw new BadRequestException('Giao dịch top-up đã được xử lý');
      }

      const wallet = await tx.wallet.upsert({
        where: { userId: payment.userId },
        create: {
          userId: payment.userId,
          balance: payment.amount,
          currency: 'VND',
        },
        update: { balance: { increment: payment.amount } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: payment.amount,
          type: 'TOPUP',
          description: 'Wallet top-up',
          metadata: { paymentId: payment.id, provider: 'MOCK_QR' },
        },
      });

      return tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
    });

    this.logger.log(`Confirmed mock wallet top-up ${paymentId}`);
    return result;
  }

  private async completeBookingPayment(paymentId: string, provider: string) {
    return this.db.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { booking: true },
      });
      if (!payment || !payment.booking) {
        throw new NotFoundException('Giao dịch không hợp lệ');
      }
      assertVndAmount(payment.amount, { field: 'Số tiền payment' });
      assertVndAmount(payment.booking.totalPrice, {
        field: 'Tổng tiền booking',
      });
      if (payment.amount !== payment.booking.totalPrice) {
        throw new BadRequestException(
          'Số tiền payment không khớp tổng tiền booking',
        );
      }
      if (payment.status === PaymentStatus.COMPLETED) return payment;

      const paymentClaim = await tx.payment.updateMany({
        where: { id: paymentId, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.COMPLETED, paidAt: new Date() },
      });
      if (paymentClaim.count !== 1) {
        throw new BadRequestException('Giao dịch đã được xử lý');
      }

      const bookingClaim = await tx.booking.updateMany({
        where: { id: payment.booking.id, status: BookingStatus.APPROVED },
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
            provider,
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

  private paymentAttemptId(seed: string) {
    return createHash('sha256')
      .update(`booking-payment:${seed}`)
      .digest('hex')
      .slice(0, 24);
  }

  private merchantOrderId(paymentId: string) {
    return `PAY-${createHash('sha256')
      .update(`merchant-order:${paymentId}`)
      .digest('hex')
      .slice(0, 32)}`;
  }

  private assertMockPaymentsEnabled() {
    if (!this.mockPaymentsEnabled) {
      throw new ServiceUnavailableException('Mock payment chỉ được bật ở môi trường dev');
    }
  }
}
