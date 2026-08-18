import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BookingStatus,
  PaymentStatus,
  Prisma,
  SettlementStatus,
  UserRole,
} from '@prisma/client';
import { createHash } from 'crypto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PaymentQueryDto,
  RefundPaymentDto,
  ReleasePaymentDto,
  RunSettlementDto,
  SettlementHistoryQueryDto,
} from './dto/admin.dto';

@Injectable()
export class AdminFinanceService {
  private readonly logger = new Logger(AdminFinanceService.name);
  private readonly platformUserId: string;

  constructor(
    private readonly db: PrismaService,
    config: ConfigService,
  ) {
    this.platformUserId = config.getOrThrow<string>('PLATFORM_USER_ID');
  }

  async getPayments(query: PaginationDto & PaymentQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.PaymentWhereInput = {
      status: query.status,
      createdAt:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined,
            }
          : undefined,
    };

    return this.db.payment.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        bookingId: true,
        userId: true,
        walletId: true,
        amount: true,
        paymentMethod: true,
        transactionId: true,
        status: true,
        paidAt: true,
        refundedAt: true,
        failureReason: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        booking: {
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            totalPrice: true,
          },
        },
      },
    });
  }

  async getPlatformWallet() {
    return this.db.wallet.findUnique({
      where: { userId: this.platformUserId },
      select: {
        id: true,
        userId: true,
        balance: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async runSettlement(dto: RunSettlementDto) {
    const owners = await this.db.user.findMany({
      where: {
        role: UserRole.OWNER,
        ...(dto.ownerId ? { id: dto.ownerId } : {}),
      },
      select: { id: true },
    });

    if (dto.ownerId && owners.length === 0) {
      throw new NotFoundException('Owner không tồn tại');
    }

    const totals = await this.db.ownerTransaction.groupBy({
      by: ['ownerId'],
      where: {
        ownerId: { in: owners.map((owner) => owner.id) },
        type: 'RENTAL_INCOME',
        status: 'completed',
      },
      _sum: { amount: true },
    });
    const totalByOwner = new Map(
      totals.map((row) => [row.ownerId, row._sum.amount ?? 0]),
    );

    let created = 0;
    let skipped = 0;

    for (const owner of owners) {
      const settlementId = createHash('sha256')
        .update(`settlement:${owner.id}:${dto.period}`)
        .digest('hex')
        .slice(0, 24);
      const totalEarnings = totalByOwner.get(owner.id) ?? 0;

      try {
        await this.db.settlement.create({
          data: {
            id: settlementId,
            ownerId: owner.id,
            period: dto.period,
            totalEarnings,
            totalPayouts: 0,
            netAmount: totalEarnings,
            status: SettlementStatus.COMPLETED,
            processedAt: new Date(),
          },
        });
        created += 1;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          skipped += 1;
          continue;
        }
        throw error;
      }
    }

    return { success: true, created, skipped };
  }

  async getSettlementHistory(
    query: PaginationDto & SettlementHistoryQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.SettlementWhereInput = {
      period: query.period,
      status: query.status,
      ownerId: query.ownerId,
    };

    const [items, total] = await Promise.all([
      this.db.settlement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      this.db.settlement.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async releasePayment(dto: ReleasePaymentDto) {
    const { bookingId, platformFeePercent = 20 } = dto;

    const result = await this.db.$transaction(async (tx) => {
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

      const bookingClaim = await tx.booking.updateMany({
        where: { id: bookingId, status: BookingStatus.CONFIRMED },
        data: { status: BookingStatus.COMPLETED },
      });
      if (bookingClaim.count !== 1) {
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

      const ownerWallet = await tx.wallet.upsert({
        where: { userId: booking.car.ownerId },
        create: { userId: booking.car.ownerId, balance: ownerAmount },
        update: { balance: { increment: ownerAmount } },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: ownerWallet.id,
          amount: ownerAmount,
          type: 'RENTAL_INCOME',
          description: `Giải ngân booking ${booking.id}`,
          metadata: {
            operation: 'RELEASE_PAYMENT',
            bookingId: booking.id,
            paymentId: payment.id,
            platformFee,
          },
        },
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

    this.logger.log(`Released payment for booking ${bookingId}`);
    return result;
  }

  async refundPayment(dto: RefundPaymentDto) {
    const { bookingId, refundPercent = 100, reason } = dto;

    const result = await this.db.$transaction(async (tx) => {
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

      const paymentClaim = await tx.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.COMPLETED },
        data: {
          status: PaymentStatus.REFUNDED,
          refundedAt: new Date(),
          failureReason: `Refund ${refundPercent}%: ${reason.trim()}`,
        },
      });
      if (paymentClaim.count !== 1) {
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
            operation: 'ADMIN_REFUND',
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

    this.logger.warn(`Refunded booking ${bookingId}`);
    return result;
  }

  async getPendingWithdraws(query: PaginationDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.OwnerTransactionWhereInput = {
      type: 'WITHDRAW',
      status: 'pending',
    };

    const [items, total] = await Promise.all([
      this.db.ownerTransaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      this.db.ownerTransaction.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async approveWithdraw(id: string) {
    const claim = await this.db.ownerTransaction.updateMany({
      where: { id, type: 'WITHDRAW', status: 'pending' },
      data: { status: 'completed' },
    });
    if (claim.count !== 1) {
      throw new BadRequestException(
        'Yêu cầu rút tiền không tồn tại hoặc đã được xử lý',
      );
    }
    this.logger.log(`Approved withdraw ${id}`);
  }

  async rejectWithdraw(id: string, reason: string) {
    await this.db.$transaction(async (tx) => {
      const withdraw = await tx.ownerTransaction.findUnique({ where: { id } });
      if (!withdraw) throw new NotFoundException('Withdraw transaction not found');
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
    });
    this.logger.warn(`Rejected withdraw ${id}`);
  }

  async getPendingReleaseTrips(query: PaginationDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.TripWhereInput = {
      status: 'COMPLETED',
      booking: { status: BookingStatus.CONFIRMED },
    };

    const [items, total] = await Promise.all([
      this.db.trip.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          booking: { include: { payments: true } },
          car: { include: { owner: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.db.trip.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async autoReleaseCompletedTrips() {
    const { items } = await this.getPendingReleaseTrips({ page: 1, limit: 50 });
    let processed = 0;
    let skipped = 0;

    for (const trip of items) {
      try {
        await this.releasePayment({ bookingId: trip.bookingId });
        processed += 1;
      } catch (error) {
        skipped += 1;
        this.logger.warn(
          `Auto-release skipped booking ${trip.bookingId}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }

    return { processed, skipped };
  }
}
