import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponse } from '../../common/dto/response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MomoIpnDto } from './dto/momo.dto';
import { PaymentService } from './payment.service';

@Controller('api/payments/momo')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER, UserRole.OWNER, UserRole.ADMIN)
export class MomoController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post(':payment_id/checkout')
  async createCheckout(
    @CurrentUser('id') userId: string,
    @Param('payment_id') paymentId: string,
  ) {
    const checkout = await this.paymentService.createMomoCheckout(
      userId,
      paymentId,
    );
    return ApiResponse.success(checkout, 'MoMo sandbox checkout created');
  }

  @Get(':payment_id/status')
  async queryStatus(
    @CurrentUser('id') userId: string,
    @Param('payment_id') paymentId: string,
  ) {
    const status = await this.paymentService.queryMomoStatus(userId, paymentId);
    return ApiResponse.success(status);
  }

  @Public()
  @Post('ipn')
  @HttpCode(HttpStatus.NO_CONTENT)
  async handleIpn(@Body() payload: MomoIpnDto): Promise<void> {
    await this.paymentService.handleMomoIpn(payload);
  }
}
