import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, PaymentStatus, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { CustomerService } from './customer.service';
import { CreatePaymentDto } from './dto/customer.dto';

@Injectable()
export class SecureCustomerService extends CustomerService {
  private readonly logger = new Logger(SecureCustomerService.name);
  private readonly platformUserId: string;

  constructor(
    private readonly db: PrismaService,
    uploadService: UploadService,
    config: ConfigService,
  ) {
    super(db, uploadService);
    this.platformUserId = config.getOrThrow<string>('PLATFORM_USER_ID');
  }

  override async createPayment(userId: string, dto: CreatePaymentDto) {
    const booking = await this.db.booking.findUnique({
      where: { id: dto.bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy booking');
    }
    if (booking.customerId !== userId) {
      throw new BadRequestException('Booking không thuộc tài khoản hiện tại');
    }
    if (booking.status !== BookingStatus.APPROVED) {
      throw new BadRequestException(
        'Booking phải ở trạng thái APPROVED mới có thể thanh toán',
      );
    }

    const paymentId = createHash('sha256')
      .update(`payment:${booking.id}:${userId}`)
      .digest('hex')
      .slice(0, 24);
    const transactionId = `PAY-${createHash('sha256')
      .update(`transaction:${booking.id}:${userId}`)
      .digest('hex')
      .slice(0, 32)}`;

    const existing = await this.db.payment.findUnique({
      where: { id: paymentId },
    });
    if (existing) return existing;

    try {
      return await this.db.payment.create({
        data: {
          id: paymentId,
          bookingId: booking.id,
          userId,
          amount: booking.totalPrice,
          paymentMethod: dto.paymentMethod,
          status: PaymentStatus.PENDING,
          transactionId,
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
        if (replay) return replay;
      }
      throw error;
    }
  }

  override async confirmPaymentInternal(paymentId: string) {
    const result = await this.db.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { booking: true },
      });

      if (!payment || !payment.booking) {
        throw new NotFoundException('Giao dịch không hợp lệ');
      }

      const claim = await tx.payment.updateMany({
        where: { id: paymentId, status: PaymentStatus.PENDING },
        data: {
          status: PaymentStatus.COMPLETED,
          paidAt: new Date(),
        },
      });
      if (claim.count !== 1) {
        throw new BadRequestException('Giao dịch đã được xử lý');
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
          description: `Giữ tiền cho booking ${payment.bookingId}`,
          metadata: {
            operation: 'PAYMENT_CONFIRMED',
            bookingId: payment.bookingId,
            paymentId: payment.id,
          },
        },
      });

      const bookingClaim = await tx.booking.updateMany({
        where: {
          id: payment.bookingId ?? undefined,
          status: BookingStatus.APPROVED,
        },
        data: { status: BookingStatus.CONFIRMED },
      });
      if (bookingClaim.count !== 1) {
        throw new BadRequestException('Booking không còn có thể xác nhận thanh toán');
      }

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

      const updatedPayment = await tx.payment.findUnique({
        where: { id: paymentId },
      });
      if (!updatedPayment) {
        throw new NotFoundException('Giao dịch không tồn tại');
      }
      return updatedPayment;
    });

    this.logger.log(`Confirmed payment ${paymentId}`);
    return result;
  }

  override async cancelBooking(userId: string, bookingId: string) {
    const result = await this.db.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, customerId: userId },
        include: { payments: true },
      });

      if (!booking) {
        throw new NotFoundException('Không tìm thấy đơn đặt xe');
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
          const escrowDebit = await tx.wallet.updateMany({
            where: {
              userId: this.platformUserId,
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

          await tx.walletTransaction.create({
            data: {
              walletId: customerWallet.id,
              amount: completedPayment.amount,
              type: 'REFUND',
              description: `Hoàn tiền đơn ${bookingId}`,
              metadata: {
                operation: 'CUSTOMER_CANCEL',
                bookingId,
                paymentId: completedPayment.id,
                refundPercent: 100,
              },
            },
          });
        }
      }

      const updatedBooking = await tx.booking.findUnique({
        where: { id: bookingId },
      });
      if (!updatedBooking) {
        throw new NotFoundException('Không tìm thấy đơn đặt xe');
      }
      return updatedBooking;
    });

    this.logger.log(`Cancelled booking ${bookingId} for customer ${userId}`);
    return result;
  }
}
