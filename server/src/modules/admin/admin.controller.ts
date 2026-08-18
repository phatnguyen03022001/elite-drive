import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Patch,
  Param,
  Put,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminFinanceService } from './admin-finance.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiResponse } from '../../common/dto/response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import {
  ReportDateRangeDto,
  CreatePromotionDto,
  PromotionQueryDto,
  UpdatePromotionDto,
  PaymentQueryDto,
  RunSettlementDto,
  SettlementHistoryQueryDto,
  ReleasePaymentDto,
  RefundPaymentDto,
  AdminKYCQueryDto,
  RejectKYCDto,
  CreateCategoryDto,
  CreateLocationDto,
  ResolveDisputeDto,
  UpdateUserStatusDto,
  RejectWithdrawDto,
} from './dto/admin.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  CustomerProfileResponseDto,
  UpdateCustomerProfileDto,
} from '../customer/dto/customer.dto';
import { CustomerService } from '../customer/customer.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly financeService: AdminFinanceService,
    private readonly customerService: CustomerService,
  ) {}

  @Get('profile')
  async getProfile(
    @CurrentUser('id') userId: string,
  ): Promise<ApiResponse<CustomerProfileResponseDto>> {
    const profile = await this.customerService.getProfile(userId);
    return ApiResponse.success(profile);
  }

  @Put('profile')
  @UseInterceptors(FileInterceptor('avatar'))
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateCustomerProfileDto,
    @UploadedFile() avatarFile?: Express.Multer.File,
  ): Promise<ApiResponse<CustomerProfileResponseDto>> {
    const updated = await this.customerService.updateProfile(
      userId,
      dto,
      avatarFile,
    );
    return ApiResponse.success(updated, 'Cập nhật thành công');
  }

  @Get('reports/overview')
  async getOverviewReport() {
    const overview = await this.adminService.getOverviewReport();
    return ApiResponse.success(overview);
  }

  @Get('reports/bookings')
  async getBookingsReport(@Query() query: ReportDateRangeDto) {
    const report = await this.adminService.getBookingsReport(query);
    return ApiResponse.success(report);
  }

  @Get('reports/revenue')
  async getRevenueReport(@Query() query: ReportDateRangeDto) {
    const revenue = await this.adminService.getRevenueReport(query);
    return ApiResponse.success(revenue);
  }

  @Get('cars/pending')
  async getPendingCars() {
    const cars = await this.adminService.getPendingCars();
    return ApiResponse.success(cars);
  }

  @Post('cars/:car_id/approve')
  async approveCar(@Param('car_id') carId: string) {
    await this.adminService.approveCar(carId);
    return ApiResponse.success(null, 'Xe đã được phê duyệt');
  }

  @Get('cars/all')
  async getAllCars(@Query('status') status?: string) {
    const cars = await this.adminService.getAllCars(status);
    return ApiResponse.success(cars);
  }

  @Post('cars/:car_id/reject')
  async rejectCar(
    @Param('car_id') carId: string,
    @Body('reason') reason: string,
  ) {
    await this.adminService.rejectCar(carId, reason);
    return ApiResponse.success(null, 'Đã từ chối phê duyệt xe');
  }

  @Get('kyc/customers')
  async getKycCustomers(@Query() query: PaginationDto & AdminKYCQueryDto) {
    const result = await this.adminService.getKycCustomers(query);
    return ApiResponse.success(result);
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
    const promotion = await this.adminService.createPromotion(dto);
    return ApiResponse.success(promotion, 'Khuyến mãi đã tạo');
  }

  @Patch('promotions/:id')
  async updatePromotion(
    @Param('id') id: string,
    @Body() dto: UpdatePromotionDto,
  ) {
    const updated = await this.adminService.updatePromotion(id, dto);
    return ApiResponse.success(updated, 'Khuyến mãi đã cập nhật');
  }

  @Get('promotions')
  async getPromotions(@Query() query: PromotionQueryDto) {
    const promotions = await this.adminService.getPromotions(query);
    return ApiResponse.success(promotions);
  }

  @Get('payments')
  async getPayments(@Query() query: PaginationDto & PaymentQueryDto) {
    const payments = await this.financeService.getPayments(query);
    return ApiResponse.success(payments);
  }

  @Post('settlements/run')
  async runSettlement(@Body() dto: RunSettlementDto) {
    const settlement = await this.financeService.runSettlement(dto);
    return ApiResponse.success(settlement, 'Settlement đã chạy');
  }

  @Get('settlements/history')
  async getSettlementHistory(
    @Query() query: PaginationDto & SettlementHistoryQueryDto,
  ) {
    const history = await this.financeService.getSettlementHistory(query);
    return ApiResponse.success(history);
  }

  @Get('disputes')
  async getAll(@Query() query: PaginationDto) {
    return this.adminService.getAllDisputes(query);
  }

  @Patch('disputes/:id/process')
  async startProcessing(@Param('id') id: string) {
    return this.adminService.updateToInProgress(id);
  }

  @Post('disputes/:id/resolve')
  async resolve(@Param('id') id: string, @Body() dto: ResolveDisputeDto) {
    return this.adminService.resolveDispute(id, dto);
  }

  @Post('categories')
  async createCategory(@Body() dto: CreateCategoryDto) {
    const category = await this.adminService.createCategory(dto);
    return ApiResponse.success(category, 'Danh mục đã tạo');
  }

  @Post('locations')
  async createLocation(@Body() dto: CreateLocationDto) {
    const location = await this.adminService.createLocation(dto);
    return ApiResponse.success(location, 'Địa điểm đã tạo');
  }

  @Post('payments/release')
  async releasePayment(@Body() dto: ReleasePaymentDto) {
    const result = await this.financeService.releasePayment(dto);
    return ApiResponse.success(
      result,
      `Đã chuyển ${result.ownerReceived} VND cho owner`,
    );
  }

  @Post('payments/refund')
  async refundPayment(@Body() dto: RefundPaymentDto) {
    const result = await this.financeService.refundPayment(dto);
    return ApiResponse.success(
      result,
      `Đã hoàn ${result.refundAmount} VND cho khách`,
    );
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
  async updateUserStatus(
    @Param('id') userId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    await this.adminService.updateUserStatus(userId, dto.status === 'ACTIVE');
    return ApiResponse.success(null, 'Trạng thái user đã cập nhật');
  }

  @Get('escrow/pending-release')
  async getPendingReleaseTrips(@Query() query: PaginationDto) {
    const result = await this.financeService.getPendingReleaseTrips(query);
    return ApiResponse.success(result);
  }

  @Get('withdraws/pending')
  async getPendingWithdraws(@Query() query: PaginationDto) {
    const result = await this.financeService.getPendingWithdraws(query);
    return ApiResponse.success(result);
  }

  @Post('withdraws/:id/approve')
  async approveWithdraw(@Param('id') id: string) {
    await this.financeService.approveWithdraw(id);
    return ApiResponse.success(null, 'Đã duyệt rút tiền');
  }

  @Post('withdraws/:id/reject')
  async rejectWithdraw(@Param('id') id: string, @Body() dto: RejectWithdrawDto) {
    await this.financeService.rejectWithdraw(id, dto.reason);
    return ApiResponse.success(null, 'Đã từ chối rút tiền');
  }

  @Post('settlements/auto-release')
  async autoReleasePayments() {
    const result = await this.financeService.autoReleaseCompletedTrips();
    return ApiResponse.success(
      result,
      `Đã release ${result.processed} payments`,
    );
  }
}
