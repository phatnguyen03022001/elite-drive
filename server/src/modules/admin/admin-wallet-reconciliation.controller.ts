import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ApiResponse } from '../../common/dto/response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminFinanceService } from './admin-finance.service';

@Controller('api/admin/wallets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminWalletReconciliationController {
  constructor(private readonly financeService: AdminFinanceService) {}

  @Get('reconciliation')
  async reconcile(@Query() query: PaginationDto) {
    return ApiResponse.success(
      await this.financeService.reconcileWalletLedger(query),
    );
  }
}
