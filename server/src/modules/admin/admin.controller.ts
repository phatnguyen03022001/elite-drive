import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ApiResponse } from '../../common/dto/response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { imageUploadOptions } from '../../common/upload/image-upload-options';
import {
  CustomerProfileResponseDto,
  UpdateCustomerProfileDto,
} from '../customer/dto/customer.dto';
import { CustomerProfileService } from '../customer/customer-profile.service';
import { AdminFinanceService } from './admin-finance.service';
import { AdminPromotionService } from './admin-promotion.service';
import { AdminRefundService } from './admin-refund.service';
import { AdminSettlementService } from './admin-settlement.service';
import { AdminWithdrawalService } from './admin-withdrawal.service';
import { AdminService } from './admin.service';
import { ApproveWithdrawDto } from './dto/admin-withdraw.dto';
import {
  AdminKYCQueryDto,
  CreateCategoryDto,
  CreateLocationDto,
  CreatePromotionDto,
  DisputeQueryDto,
  PaymentQueryDto,
  PromotionQueryDto,
  RefundPaymentDto,
  RejectCarDto,
  RejectKYCDto,
  RejectWithdrawDto,
  ReleasePaymentDto,
  ReportDateRangeDto,
  ResolveDisputeDto,
  RunSettlementDto,
  SettlementHistoryQueryDto,
  UpdatePromotionDto,
  UpdateUserStatusDto,
} from './dto/admin.dto';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly financeService: AdminFinanceService,
    private readonly promotionService: AdminPromotionService,
    private readonly refundService: AdminRefundService,
    private readonly settlementService: AdminSettlementService,
    private readonly withdrawalService: AdminWithdrawalService,
    private readonly profileService: CustomerProfileService,
  ) {}

  @Get('profile')
  async getProfile(@CurrentUser('id') userId: string): Promise<ApiResponse<CustomerProfileResponseDto>> {
    return ApiResponse.success(await this.profileService.getProfile(userId));
  }

  @Put('profile')
  @UseInterceptors(FileInterceptor('avatar', imageUploadOptions))
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateCustomerProfileDto,
    @UploadedFile() avatarFile?: Express.Multer.File,
  ): Promise<ApiResponse<CustomerProfileResponseDto>> {
    return ApiResponse.success(
      await this.profileService.updateProfile(userId, dto, avatarFile),
      'Cập nhật thành công',
    );
  }

  @Get('reports/overview')
  async getOverviewReport() {
    return ApiResponse.success(await this.adminService.getOverviewReport());
  }

  @Get('reports/bookings')
  async getBookingsReport(@Query() query: ReportDateRangeDto) {
    return ApiResponse.success(await this.adminService.getBookingsReport(query));
  }

  @Get('reports/revenue')
  async getRevenueReport(@Query() query: ReportDateRangeDto) {
    return ApiResponse.success(await this.adminService.getRevenueReport(query));
  }

  @Get('cars/pending')
  async getPendingCars() {
    return ApiResponse.success(await this.adminService.getPendingCars());
  }

  @Post('cars/:car_id/approve')
  async approveCar(@Param('car_id') carId: string) {
    await this.adminService.approveCar(carId);
    return ApiResponse.success(null, 'Xe đã được phê duyệt');
  }

  @Get('cars/all')
  async getAllCars(@Query('status') status?: string) {
    return ApiResponse.success(await this.adminService.getAllCars(status));
  }

  @Post('cars/:car_id/reject')
  async rejectCar(@Param('car_id') carId: string, @Body() dto: RejectCarDto) {
    await this.adminService.rejectCar(carId, dto.reason);
    return ApiResponse.success(null, 'Đã từ chối phê duyệt xe');
  }

  @Get('kyc/customers')
  async getKycCustomers(@Query() query: PaginationDto & AdminKYCQueryDto) {
    return ApiResponse.success(await this.adminService.getKycCustomers(query));
  }

  @Post('kyc/customers/:user_id/approve')
  async approveKyc(@Param('user_id') userId: string) {
    await this.adminService.approveKyc(userId);
    return ApiResponse.success(null, 'KYC đã được phê duyệt');
  }

  @Post('kyc/customers/:user_id/reject')
  async rejectKyc(@Param('user_id') userId: string, @Body() dto: RejectKYCDto) {
    await this.adminService.rejectKyc(userId, dto);
    return ApiResponse.success(null, 'KYC đã bị từ chối');
  }

  @Post('promotions')
  async createPromotion(@Body() dto: CreatePromotionDto) {
    return ApiResponse.success(await this.promotionService.create(dto), 'Khuyến mãi đã tạo');
  }

  @Patch('promotions/:id')
  async updatePromotion(@Param('id') id: string, @Body() dto: UpdatePromotionDto) {
    return ApiResponse.success(await this.promotionService.update(id, dto), 'Khuyến mãi đã cập nhật');
  }

  @Get('promotions')
  async getPromotions(@Query() query: PromotionQueryDto) {
    return ApiResponse.success(await this.promotionService.getAll(query));
  }

  @Get('payments')
  async getPayments(@Query() query: PaginationDto & PaymentQueryDto) {
    return ApiResponse.success(await this.financeService.getPayments(query));
  }

  @Post('settlements/run')
  async runSettlement(@Body() dto: RunSettlementDto) {
    return ApiResponse.success(await this.settlementService.run(dto), 'Settlement đã chạy');
  }

  @Get('settlements/history')
  async getSettlementHistory(@Query() query: PaginationDto & SettlementHistoryQueryDto) {
    return ApiResponse.success(await this.settlementService.getHistory(query));
  }

  @Get('disputes')
  async getAllDisputes(@Query() query: PaginationDto & DisputeQueryDto) {
    return ApiResponse.success(await this.adminService.getAllDisputes(query));
  }

  @Patch('disputes/:id/process')
  async startProcessing(@Param('id') id: string) {
    await this.adminService.updateToInProgress(id);
    return ApiResponse.success(null, 'Dispute moved to in-progress');
  }

  @Post('disputes/:id/resolve')
  async resolve(@Param('id') id: string, @Body() dto: ResolveDisputeDto) {
    return ApiResponse.success(await this.adminService.resolveDispute(id, dto), 'Dispute resolved');
  }

  @Post('categories')
  async createCategory(@Body() dto: CreateCategoryDto) {
    return ApiResponse.success(await this.adminService.createCategory(dto), 'Danh mục đã tạo');
  }

  @Post('locations')
  async createLocation(@Body() dto: CreateLocationDto) {
    return ApiResponse.success(await this.adminService.createLocation(dto), 'Địa điểm đã tạo');
  }

  @Post('payments/release')
  async releasePayment(@Body() dto: ReleasePaymentDto) {
    const result = await this.financeService.releasePayment(dto);
    return ApiResponse.success(result, `Đã chuyển ${result.ownerReceived} VND cho owner`);
  }

  @Post('payments/refund')
  async refundPayment(@Body() dto: RefundPaymentDto) {
    const result = await this.refundService.refundPayment(dto);
    return ApiResponse.success(result, `Đã hoàn ${result.refundAmount} VND cho khách`);
  }

  @Get('wallets/platform')
  async getPlatformWallet() {
    return ApiResponse.success(await this.financeService.getPlatformWallet());
  }

  @Get('bookings/all')
  async getAllBookings(@Query() query: PaginationDto) {
    return ApiResponse.success(await this.adminService.getAllBookings(query));
  }

  @Get('contracts/all')
  async getAllContracts(@Query() query: PaginationDto) {
    return ApiResponse.success(await this.adminService.getAllContracts(query));
  }

  @Get('users')
  async getUsers(@Query() query: PaginationDto) {
    return ApiResponse.success(await this.adminService.getUsers(query));
  }

  @Patch('users/:id/status')
  async updateUserStatus(@Param('id') userId: string, @Body() dto: UpdateUserStatusDto) {
    await this.adminService.updateUserStatus(userId, dto.status === 'ACTIVE');
    return ApiResponse.success(null, 'Trạng thái user đã cập nhật');
  }

  @Get('escrow/pending-release')
  async getPendingReleaseTrips(@Query() query: PaginationDto) {
    return ApiResponse.success(await this.financeService.getPendingReleaseTrips(query));
  }

  @Get('withdraws/pending')
  async getPendingWithdraws(@Query() query: PaginationDto) {
    return ApiResponse.success(await this.withdrawalService.getPending(query));
  }

  @Post('withdraws/:id/approve')
  async approveWithdraw(
    @Param('id') id: string,
    @Body() dto: ApproveWithdrawDto,
  ) {
    const result = await this.withdrawalService.approve(id, dto);
    return ApiResponse.success(result, 'Đã xác nhận payout và duyệt rút tiền');
  }

  @Post('withdraws/:id/reject')
  async rejectWithdraw(@Param('id') id: string, @Body() dto: RejectWithdrawDto) {
    await this.withdrawalService.reject(id, dto.reason);
    return ApiResponse.success(null, 'Đã từ chối rút tiền');
  }

  @Post('settlements/auto-release')
  async autoReleasePayments() {
    const result = await this.financeService.autoReleaseCompletedTrips();
    return ApiResponse.success(result, `Đã release ${result.processed} payments`);
  }
}
