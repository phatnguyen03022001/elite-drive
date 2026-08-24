import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponse } from '../../common/dto/response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaymentService } from '../payment/payment.service';

class ReconcileMomoQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

@Controller('api/admin/payments/momo')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminPaymentReconciliationController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('reconcile')
  async reconcile(@Query() query: ReconcileMomoQueryDto) {
    const summary = await this.paymentService.reconcilePendingMomoPayments(
      query.limit,
    );
    return ApiResponse.success(summary, 'MoMo reconciliation completed');
  }

  @Get('conflicts')
  async listConflicts(@Query() query: ReconcileMomoQueryDto) {
    const conflicts = await this.paymentService.listOpenMomoProviderSuccessConflicts(
      query.limit,
    );
    return ApiResponse.success(conflicts, 'MoMo conflicts retrieved');
  }

  @Post('conflicts/:paymentId/recover')
  async recoverConflict(@Param('paymentId') paymentId: string) {
    const result = await this.paymentService.recoverMomoProviderSuccessConflict(
      paymentId,
    );
    return ApiResponse.success(result, 'MoMo conflict recovery completed');
  }
}
