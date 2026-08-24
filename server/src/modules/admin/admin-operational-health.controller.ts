import { Controller, Get, UseGuards } from '@nestjs/common';
import { PaymentStatus, SettlementStatus, DisputeStatus, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponse } from '../../common/dto/response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';

const MOMO_STALE_MINUTES = 15;
const RECENT_FAILURE_HOURS = 24;

@Controller('api/admin/operations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminOperationalHealthController {
  constructor(private readonly db: PrismaService) {}

  @Get('health')
  async getHealth() {
    const generatedAt = new Date();
    const staleMomoBefore = new Date(
      generatedAt.getTime() - MOMO_STALE_MINUTES * 60_000,
    );
    const recentFailureSince = new Date(
      generatedAt.getTime() - RECENT_FAILURE_HOURS * 60 * 60_000,
    );

    const [
      staleMomoPayments,
      failedPayments24h,
      openDisputes,
      pendingWithdrawals,
      pendingSettlements,
      openMomoProviderSuccessConflicts,
    ] = await Promise.all([
      this.db.payment.count({
        where: {
          paymentMethod: 'MOMO',
          status: PaymentStatus.PENDING,
          createdAt: { lt: staleMomoBefore },
        },
      }),
      this.db.payment.count({
        where: {
          status: PaymentStatus.FAILED,
          updatedAt: { gte: recentFailureSince },
        },
      }),
      this.db.dispute.count({
        where: {
          status: { in: [DisputeStatus.OPEN, DisputeStatus.IN_PROGRESS] },
        },
      }),
      this.db.ownerTransaction.count({
        where: { type: 'WITHDRAW', status: 'pending' },
      }),
      this.db.settlement.count({
        where: {
          status: {
            in: [SettlementStatus.PENDING, SettlementStatus.PROCESSING],
          },
        },
      }),
      this.db.payment.count({
        where: {
          paymentMethod: 'MOMO',
          status: PaymentStatus.FAILED,
          providerSuccessConflictAt: { not: null },
        },
      }),
    ]);

    const queues = {
      staleMomoPayments,
      failedPayments24h,
      openDisputes,
      pendingWithdrawals,
      pendingSettlements,
      openMomoProviderSuccessConflicts,
    };
    const needsAttention = Object.values(queues).reduce(
      (total, count) => total + count,
      0,
    );

    return ApiResponse.success({
      generatedAt: generatedAt.toISOString(),
      status: needsAttention === 0 ? ('healthy' as const) : ('attention' as const),
      needsAttention,
      thresholds: {
        momoPendingMinutes: MOMO_STALE_MINUTES,
        recentFailureHours: RECENT_FAILURE_HOURS,
      },
      queues,
    });
  }
}
