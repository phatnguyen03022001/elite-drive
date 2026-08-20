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

    const paymentId = createHash('sha256')
      .update(`booking-payment:${booking.id}:${userId}`)
      .digest('hex')
      .slice(0, 24);
    const merchantOrderId = `PAY-${createHash('sha256')
      .update(`merchant-order:${booking.id}:${userId}`)
      .digest('hex')
      .slice(0, 32)}`;

    const existing = await this.db.payment.findUnique({ where: { id: paymentId } });
    if (existing) {
      if (existing.paymentMethod !== paymentMethod) {
        throw new BadRequestException(
          'Booking đã có payment bằng phương thức khác',
        );
      }
      assertVndAmount(existing.amount, { field: 'Số tiền payment' });
      if (existing.amount !== booking.totalPrice) {
        throw new BadRequestException(
          'Payment hiện tại không khớp tổng tiền booking',
        );
      }
      return existing;
    }

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
        const replay = await this.db.payment.findUnique({ where: { id: paymentId } });
        if (replay) return replay;
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
    });
    if (!payment) {
      throw new NotFoundException('Không tìm thấy yêu cầu thanh toán mock');
    }
    if (payment.transactionId !== dto.transactionId) {
      throw new BadRequestException('Transaction ID không khớp');
    }
    return this.completeBookingPayment(payment.id, 'MOCK_QR');
  }

  async cancelBooking(userId: string, bookingId: string) {
    const result = await this.db.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, customerId: userId },
        include: { payments: true },
      });
      if (!booking) throw new NotFoundException('Không tìm thấy đơn đặt xe');

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
        },
        data: { status: BookingStatus.CANCELLED },
      });
      if (bookingClaim.count !== 1) {
        throw new BadRequestException('Booking đã được xử lý hoặc không thể hủy');
      }

      const completedPayment = booking.payments.find(
        (payment) => payment.status === PaymentStatus.COMPLETED,
      );
      if (completedPayment) {
        assertVndAmount(completedPayment.amount, { field: 'Số tiền hoàn' });
        const refundClaim = await tx.payment.updateMany({
          where: {
            id: completedPayment.id,
            status: PaymentStatus.COMPLETED,
            refundedAt: null,
          },
          data: {
            status: PaymentStatus.REFUNDED,
            refundedAt: new Date(),
            failureReason: 'Refund 100%: CUSTOMER_CANCEL',
          },
        });

        if (refundClaim.count === 1) {
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
            create: { userId, balance: completedPayment.amount },
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
        }
      }

      return tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    });

    this.logger.log(`Cancelled booking ${bookingId} for customer ${userId}`);
    return result;
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
          bookingId: null,
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

  private assertMockPaymentsEnabled() {
    if (!this.mockPaymentsEnabled) {
      throw new ServiceUnavailableException('Mock payment chỉ được bật ở môi trường dev');
    }
  }
}
