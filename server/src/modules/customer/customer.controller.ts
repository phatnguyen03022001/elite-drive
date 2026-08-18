import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import {
  ApiResponse,
  PaginatedResponseDto,
} from '../../common/dto/response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  BookingDetailResponseDto,
  BookingQueryDto,
  ConfirmPaymentDto,
  ContractResponseDto,
  CreateBookingDto,
  CreateDisputeDto,
  CreateKYCDto,
  CreatePaymentDto,
  CreateReviewDto,
  CreateWalletTopupDto,
  CustomerProfileResponseDto,
  KYCStatusResponseDto,
  SearchCarQueryDto,
  SignContractDto,
  TripQueryDto,
  TripStatusResponseDto,
  UpdateCustomerProfileDto,
  WalletTransactionResponseDto,
} from './dto/customer.dto';
import { CustomerBookingService } from './customer-booking.service';
import { CustomerPaymentService } from './customer-payment.service';
import { CustomerService } from './customer.service';

@Controller('api/customer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER, UserRole.OWNER, UserRole.ADMIN)
export class CustomerController {
  constructor(
    private readonly customerService: CustomerService,
    private readonly paymentService: CustomerPaymentService,
    private readonly bookingService: CustomerBookingService,
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
    const updated = await this.customerService.updateProfile(userId, dto, avatarFile);
    return ApiResponse.success(updated, 'Profile updated');
  }

  @Post('kyc')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'documentFront', maxCount: 1 },
      { name: 'documentBack', maxCount: 1 },
      { name: 'faceImage', maxCount: 1 },
    ]),
  )
  async submitKyc(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateKYCDto,
    @UploadedFiles()
    files: {
      documentFront?: Express.Multer.File[];
      documentBack?: Express.Multer.File[];
      faceImage?: Express.Multer.File[];
    },
  ): Promise<ApiResponse<unknown>> {
    const kyc = await this.customerService.submitKyc(userId, dto, files);
    return ApiResponse.success(kyc, 'KYC submission received');
  }

  @Get('kyc/status')
  async getKycStatus(
    @CurrentUser('id') userId: string,
  ): Promise<ApiResponse<KYCStatusResponseDto>> {
    const status = await this.customerService.getKycStatus(userId);
    return ApiResponse.success(status);
  }

  @Post('bookings')
  async createBooking(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateBookingDto,
  ): Promise<ApiResponse<unknown>> {
    const booking = await this.bookingService.createBooking(userId, dto);
    return ApiResponse.success(booking, 'Booking created');
  }

  @Get('bookings')
  async getBookings(
    @CurrentUser('id') userId: string,
    @Query() query: PaginationDto & BookingQueryDto,
  ): Promise<PaginatedResponseDto<BookingDetailResponseDto>> {
    const { data, total, page, limit } = await this.customerService.getBookings(userId, query);
    return new PaginatedResponseDto(data, total, page, limit);
  }

  @Get('bookings/:booking_id')
  async getBookingDetail(
    @CurrentUser('id') userId: string,
    @Param('booking_id') bookingId: string,
  ): Promise<ApiResponse<BookingDetailResponseDto>> {
    const booking = await this.customerService.getBookingDetail(userId, bookingId);
    return ApiResponse.success(booking);
  }

  @Put('bookings/:booking_id/cancel')
  async cancelBooking(
    @CurrentUser('id') userId: string,
    @Param('booking_id') bookingId: string,
  ): Promise<ApiResponse<unknown>> {
    const result = await this.paymentService.cancelBooking(userId, bookingId);
    return ApiResponse.success(result, 'Booking cancelled');
  }

  @Post('payments/create')
  async createPayment(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePaymentDto,
  ): Promise<ApiResponse<unknown>> {
    const payment = await this.paymentService.createPayment(userId, dto);
    return ApiResponse.success(
      {
        ...payment,
        ...(payment.paymentMethod === 'MOCK_QR' &&
        this.paymentService.isMockPaymentsEnabled()
          ? { mockQrUrl: `/api/customer/payments/mock-scan/${payment.id}` }
          : {}),
      },
      'Payment created',
    );
  }

  @Public()
  @Get('payments/mock-scan/:payment_id')
  async mockScanPayment(@Param('payment_id') paymentId: string): Promise<string> {
    await this.paymentService.confirmMockPaymentByQr(paymentId);
    return '<h1>Development mock payment confirmed</h1>';
  }

  @Post('payments/confirm')
  async confirmPayment(
    @CurrentUser('id') userId: string,
    @Body() dto: ConfirmPaymentDto,
  ): Promise<ApiResponse<unknown>> {
    const result = await this.paymentService.confirmMockPayment(userId, dto);
    return ApiResponse.success(result, 'Development mock payment confirmed');
  }

  @Get('payments/:booking_id')
  async getPaymentByBooking(
    @CurrentUser('id') userId: string,
    @Param('booking_id') bookingId: string,
  ): Promise<ApiResponse<unknown>> {
    const payment = await this.customerService.getPaymentByBooking(userId, bookingId);
    return ApiResponse.success(payment);
  }

  @Get('trips')
  async getTrips(
    @CurrentUser('id') userId: string,
    @Query() query: PaginationDto & TripQueryDto,
  ): Promise<PaginatedResponseDto<unknown>> {
    const { data, total, page, limit } = await this.customerService.getTrips(userId, query);
    return new PaginatedResponseDto(data, total, page, limit);
  }

  @Get('trips/:trip_id/status')
  async getTripStatus(
    @CurrentUser('id') userId: string,
    @Param('trip_id') tripId: string,
  ): Promise<ApiResponse<TripStatusResponseDto>> {
    const status = await this.customerService.getTripStatus(userId, tripId);
    return ApiResponse.success(status);
  }

  @Get('contracts/:booking_id')
  async getContract(
    @CurrentUser('id') userId: string,
    @Param('booking_id') bookingId: string,
  ): Promise<ApiResponse<ContractResponseDto>> {
    const contract = await this.customerService.getContract(userId, bookingId);
    return ApiResponse.success(contract);
  }

  @Post('contracts/:booking_id/sign')
  async signContract(
    @CurrentUser('id') userId: string,
    @Param('booking_id') bookingId: string,
    @Body() dto: SignContractDto,
  ): Promise<ApiResponse<ContractResponseDto>> {
    const signed = await this.customerService.signContract(userId, bookingId, dto);
    return ApiResponse.success(signed, 'Contract signed');
  }

  @Get('wallet')
  async getWallet(@CurrentUser('id') userId: string): Promise<ApiResponse<unknown>> {
    const wallet = await this.customerService.getWallet(userId);
    return ApiResponse.success(wallet);
  }

  @Get('wallet/transactions')
  async getWalletTransactions(
    @CurrentUser('id') userId: string,
  ): Promise<PaginatedResponseDto<WalletTransactionResponseDto>> {
    const { data, total, page, limit } = await this.customerService.getWalletTransactions(userId);
    return new PaginatedResponseDto(data, total, page, limit);
  }

  @Post('wallet/topup')
  async topupWallet(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateWalletTopupDto,
  ): Promise<ApiResponse<unknown>> {
    const payment = await this.paymentService.createWalletTopup(userId, dto);
    return ApiResponse.success(
      {
        ...payment,
        mockQrUrl: `/api/customer/wallet/topup/mock-scan/${payment.id}`,
      },
      'Development mock wallet top-up created',
    );
  }

  @Public()
  @Get('wallet/topup/mock-scan/:payment_id')
  async mockScanWalletTopup(@Param('payment_id') paymentId: string) {
    await this.paymentService.confirmMockWalletTopup(paymentId);
    return '<h1>Development mock wallet top-up confirmed</h1>';
  }

  @Post('reviews')
  async createReview(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateReviewDto,
  ): Promise<ApiResponse<unknown>> {
    const review = await this.customerService.createReview(userId, dto);
    return ApiResponse.success(review, 'Review submitted');
  }

  @Get('reviews/my')
  async getMyReviews(
    @CurrentUser('id') userId: string,
    @Query() query?: PaginationDto,
  ): Promise<PaginatedResponseDto<unknown>> {
    const { data, total, page, limit } = await this.customerService.getMyReviews(userId, query);
    return new PaginatedResponseDto(data, total, page, limit);
  }

  @Public()
  @Get('cars/search')
  async searchCars(@Query() query: SearchCarQueryDto) {
    return this.customerService.searchCars(query);
  }

  @Get('bookings/:id/price-preview')
  async previewPrice(
    @CurrentUser('id') userId: string,
    @Param('id') bookingId: string,
  ) {
    return this.customerService.previewBookingPrice(userId, bookingId);
  }

  @Post('bookings/:id/confirm')
  async confirmBooking(
    @CurrentUser('id') userId: string,
    @Param('id') bookingId: string,
  ) {
    return this.customerService.confirmBooking(userId, bookingId);
  }

  @Post('disputes')
  async createDispute(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDisputeDto,
  ) {
    const result = await this.customerService.createDispute(userId, dto);
    return ApiResponse.success(result, 'Support request submitted');
  }

  @Get('disputes')
  async getMyDisputes(@CurrentUser('id') userId: string) {
    const data = await this.customerService.getMyDisputes(userId);
    return ApiResponse.success(data);
  }

  @Public()
  @Get('promotions')
  async getActivePromotions(): Promise<ApiResponse<unknown>> {
    const promotions = await this.customerService.getActivePromotions();
    return ApiResponse.success(promotions);
  }

  @Post('promotions/apply')
  async applyPromotion(
    @CurrentUser('id') userId: string,
    @Body() dto: { bookingId: string; promoCode: string },
  ): Promise<ApiResponse<unknown>> {
    const result = await this.customerService.applyPromotion(userId, dto.bookingId, dto.promoCode);
    return ApiResponse.success(result, 'Promotion applied');
  }
}
