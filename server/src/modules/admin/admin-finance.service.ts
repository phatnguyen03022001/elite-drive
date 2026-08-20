import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { assertVndAmount, calculateVndPercent } from '../../common/money/vnd';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentQueryDto, ReleasePaymentDto } from './dto/admin.dto';

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
      createdAt: query.from || query.to ? {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      } : undefined,
    };
    const [items, total] = await Promise.all([
      this.db.payment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          bookingId: true,
          userId: true,
          amount: true,
          paymentMethod: true,
          transactionId: true,
          status: true,
          paidAt: true,
          releasedAt: true,
          refundedAt: true,
          failureReason: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          booking: { select: { id: true, status: true, startDate: true, endDate: true, totalPrice: true } },
        },
      }),
      this.db.payment.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async getPlatformWallet() {
    const wallet = await this.db.wallet.findUnique({
      where: { userId: this.platformUserId },
      select: { id: true, userId: true, balance: true, currency: true, createdAt: true, updatedAt: true },
    });
    if (wallet) assertVndAmount(wallet.balance, { allowZero: true, field: 'Số dư ví nền tảng' });
    return wallet;
  }

  async reconcileWalletLedger(query: PaginationDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [wallets, total] = await Promise.all([
      this.db.wallet.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          userId: true,
          balance: true,
          currency: true,
          user: { select: { email: true, role: true, firstName: true, lastName: true } },
        },
      }),
      this.db.wallet.count(),
    ]);
    const walletIds = wallets.map((wallet) => wallet.id);
    const journalRows = walletIds.length ? await this.db.walletTransaction.groupBy({
      by: ['walletId'],
      where: { walletId: { in: walletIds } },
      _sum: { amount: true },
    }) : [];
    const journalByWallet = new Map(journalRows.map((row) => [row.walletId, row._sum.amount ?? 0]));
    const items = wallets.map((wallet) => {
      const journalBalance = journalByWallet.get(wallet.id) ?? 0;
      const validVnd = wallet.currency === 'VND' && Number.isSafeInteger(wallet.balance) && Number.isSafeInteger(journalBalance);
      const drift = wallet.balance - journalBalance;
      return { walletId: wallet.id, userId: wallet.userId, user: wallet.user, currency: wallet.currency, balance: wallet.balance, journalBalance, drift, validVnd, isBalanced: validVnd && drift === 0 };
    });
    return {
      items,
      total,
      page,
      limit,
      summary: {
        checked: items.length,
        balanced: items.filter((item) => item.isBalanced).length,
        mismatched: items.filter((item) => item.validVnd && item.drift !== 0).length,
        invalidVnd: items.filter((item) => !item.validVnd).length,
      },
    };
  }

  async releasePayment(dto: ReleasePaymentDto) {
    const { bookingId, platformFeePercent = 20 } = dto;
    const result = await this.db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { payments: true, car: true, trip: true },
      });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.status !== BookingStatus.COMPLETED || booking.trip?.status !== 'COMPLETED') {
        throw new BadRequestException('Chuyến đi chưa hoàn thành, không thể giải ngân');
      }

      const payment = booking.payments.find((item) => item.status === PaymentStatus.COMPLETED);
      if (!payment) throw new BadRequestException('Không tìm thấy giao dịch thanh toán thành công');
      if (payment.releasedAt) throw new BadRequestException('Payment đã được giải ngân');
      assertVndAmount(payment.amount, { field: 'Số tiền payment' });
      assertVndAmount(booking.totalPrice, { field: 'Tổng tiền booking' });
      if (payment.amount !== booking.totalPrice) throw new BadRequestException('Payment không khớp tổng tiền booking');

      const releaseClaim = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: PaymentStatus.COMPLETED,
          OR: [
            { releasedAt: null },
            { releasedAt: { isSet: false } },
          ],
        },
        data: { releasedAt: new Date() },
      });
      if (releaseClaim.count !== 1) throw new BadRequestException('Payment đã được giải ngân bởi yêu cầu khác');

      const platformFee = calculateVndPercent(payment.amount, platformFeePercent);
      const ownerAmount = payment.amount - platformFee;
      assertVndAmount(ownerAmount, { allowZero: platformFeePercent === 100, field: 'Số tiền owner nhận' });

      const platformWallet = await tx.wallet.findUnique({ where: { userId: this.platformUserId } });
      if (!platformWallet) throw new BadRequestException('Ví escrow nền tảng không tồn tại');
      assertVndAmount(platformWallet.balance, { allowZero: true, field: 'Số dư escrow' });
      const escrowDebit = await tx.wallet.updateMany({
        where: { id: platformWallet.id, balance: { gte: ownerAmount } },
        data: { balance: { decrement: ownerAmount } },
      });
      if (escrowDebit.count !== 1) throw new BadRequestException('Số dư escrow không đủ để giải ngân');

      const ownerWallet = await tx.wallet.upsert({
        where: { userId: booking.car.ownerId },
        create: { userId: booking.car.ownerId, balance: ownerAmount },
        update: { balance: { increment: ownerAmount } },
      });
      await tx.walletTransaction.createMany({
        data: [
          {
            walletId: platformWallet.id,
            amount: -ownerAmount,
            type: 'ESCROW_RELEASE',
            description: `Giải ngân booking ${booking.id}`,
            metadata: { operation: 'RELEASE_PAYMENT', bookingId: booking.id, paymentId: payment.id, platformFeeRetained: platformFee, counterpartWalletId: ownerWallet.id },
          },
          {
            walletId: ownerWallet.id,
            amount: ownerAmount,
            type: 'RENTAL_INCOME',
            description: `Giải ngân booking ${booking.id}`,
            metadata: { operation: 'RELEASE_PAYMENT', bookingId: booking.id, paymentId: payment.id, platformFee, counterpartWalletId: platformWallet.id },
          },
        ],
      });
      await tx.ownerTransaction.create({
        data: {
          ownerId: booking.car.ownerId,
          bookingId: booking.id,
          amount: ownerAmount,
          type: 'RENTAL_INCOME',
          status: 'completed',
          description: `Thu nhập thuê xe (Đã trừ ${platformFeePercent}% phí sàn)`,
          metadata: { operation: 'RELEASE_PAYMENT', paymentId: payment.id, totalPaidByCustomer: payment.amount, platformFeeCharged: platformFee, feePercentage: platformFeePercent },
        },
      });
      return { success: true, ownerReceived: ownerAmount, platformFee, platformBalanceRetained: platformFee };
    });
    this.logger.log(`Released payment for booking ${bookingId}`);
    return result;
  }

  async getPendingReleaseTrips(query: PaginationDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.TripWhereInput = {
      status: 'COMPLETED',
      booking: {
        status: BookingStatus.COMPLETED,
        payments: {
          some: {
            status: PaymentStatus.COMPLETED,
            OR: [
              { releasedAt: null },
              { releasedAt: { isSet: false } },
            ],
          },
        },
      },
    };
    const [items, total] = await Promise.all([
      this.db.trip.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { booking: { include: { payments: true } }, car: { include: { owner: true } } },
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
        this.logger.warn(`Auto-release skipped booking ${trip.bookingId}: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
    return { processed, skipped };
  }
}
