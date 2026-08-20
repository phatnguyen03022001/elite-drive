import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponse } from '../../common/dto/response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateOwnerDisputeDto } from './dto/owner-dispute.dto';
import { OwnerDisputeService } from './owner-dispute.service';

@Controller('api/owner/disputes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER)
export class OwnerSupportController {
  constructor(private readonly disputeService: OwnerDisputeService) {}

  @Get()
  async getDisputes(@CurrentUser('id') ownerId: string) {
    return ApiResponse.success(await this.disputeService.getVisibleDisputes(ownerId));
  }

  @Post()
  async createDispute(
    @CurrentUser('id') ownerId: string,
    @Body() dto: CreateOwnerDisputeDto,
  ) {
    return ApiResponse.success(
      await this.disputeService.create(ownerId, dto),
      'Support case submitted',
    );
  }
}
