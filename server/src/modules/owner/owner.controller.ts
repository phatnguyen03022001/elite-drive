import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { OwnerBookingService } from './owner-booking.service';
import { OwnerFinanceService } from './owner-finance.service';
import { OwnerService } from './owner.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponse, PaginatedResponseDto } from '../../common/dto/response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { imageUploadOptions } from '../../common/upload/image-upload-options';
import {
  BlockCalendarDto,
  CarDocumentResponseDto,
  CreateCarDocumentDto,
  CreateCarDto,
  CreateKYCDto,
  CreatePricingDto,
  GetCalendarDto,
  KYCStatusResponseDto,
  OwnerBookingQueryDto,
  OwnerProfileResponseDto,
  RejectBookingDto,
  RespondDisputeDto,
  TripCheckinDto,
  TripCheckoutDto,
  UpdateCarDto,
  UpdateOwnerProfileDto,
  WithdrawRequestDto,
} from './dto/owner.dto';

@Controller('api/owner')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER)
export class OwnerController {
  constructor(
    private readonly ownerService: OwnerService,
    private readonly financeService: OwnerFinanceService,
    private readonly bookingService: OwnerBookingService,
  ) {}

  @Get('profile')
  async getProfile(
    @CurrentUser('id') userId: string,
  ): Promise<ApiResponse<OwnerProfileResponseDto>> {
    const profile = await this.ownerService.getProfile(userId);
    return ApiResponse.success(profile);
  }

  @Put('profile')
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateOwnerProfileDto,
  ) {
    const profile = await this.ownerService.updateProfile(userId, dto);
    return ApiResponse.success(profile, 'Owner profile updated');
  }

  @Post('kyc')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'documentFront', maxCount: 1 },
        { name: 'documentBack', maxCount: 1 },
        { name: 'faceImage', maxCount: 1 },
      ],
      imageUploadOptions,
    ),
  )
  async submitOwnerKyc(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateKYCDto,
    @UploadedFiles()
    files: {
      documentFront?: Express.Multer.File[];
      documentBack?: Express.Multer.File[];
      faceImage?: Express.Multer.File[];
    },
  ): Promise<ApiResponse<unknown>> {
    const kyc = await this.ownerService.submitKyc(userId, dto, files);
    return ApiResponse.success(kyc, 'Owner identity verification submitted');
  }

  @Get('kyc/status')
  async getOwnerKycStatus(
    @CurrentUser('id') userId: string,
  ): Promise<ApiResponse<KYCStatusResponseDto>> {
    const status = await this.ownerService.getKycStatus(userId);
    return ApiResponse.success(status);
  }

  @Post('cars')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'mainImage', maxCount: 1 },
        { name: 'images', maxCount: 3 },
      ],
      imageUploadOptions,
    ),
  )
  async createCar(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCarDto,
    @UploadedFiles()
    files: {
      mainImage?: Express.Multer.File[];
      images?: Express.Multer.File[];
    },
  ) {
    return this.ownerService.createCar(userId, dto, files);
  }

  @Get('cars')
  async getMyCars(
    @CurrentUser('id') userId: string,
    @Query() query?: PaginationDto,
  ) {
    const { data, total, page, limit } = await this.ownerService.getMyCars(
      userId,
      query,
    );
    return new PaginatedResponseDto(data, total, page, limit);
  }

  @Put('cars/:car_id')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'mainImage', maxCount: 1 },
        { name: 'images', maxCount: 3 },
      ],
      imageUploadOptions,
    ),
  )
  async updateCar(
    @CurrentUser('id') userId: string,
    @Param('car_id') carId: string,
    @Body() dto: UpdateCarDto,
    @UploadedFiles()
    files: {
      mainImage?: Express.Multer.File[];
      images?: Express.Multer.File[];
    },
  ) {
    return this.ownerService.updateCar(userId, carId, dto, files);
  }

  @Delete('cars/:car_id')
  async deleteCar(
    @CurrentUser('id') userId: string,
    @Param('car_id') carId: string,
  ) {
    await this.ownerService.deleteCar(userId, carId);
    return ApiResponse.success(null, 'Vehicle deleted');
  }

  @Post('cars/:car_id/documents')
  async addCarDocument(
    @CurrentUser('id') userId: string,
    @Param('car_id') carId: string,
    @Body() dto: CreateCarDocumentDto,
  ) {
    const document = await this.ownerService.addCarDocument(userId, carId, dto);
    return ApiResponse.success(document, 'Vehicle document added');
  }

  @Get('cars/:car_id/documents')
  async getCarDocuments(
    @CurrentUser('id') userId: string,
    @Param('car_id') carId: string,
  ): Promise<ApiResponse<CarDocumentResponseDto[]>> {
    const documents = await this.ownerService.getCarDocuments(userId, carId);
    return ApiResponse.success(documents);
  }

  @Post('cars/:car_id/pricing')
  async addPricing(
    @CurrentUser('id') userId: string,
    @Param('car_id') carId: string,
    @Body() dto: CreatePricingDto,
  ) {
    const pricing = await this.ownerService.updateCarPricing(userId, carId, dto);
    return ApiResponse.success(pricing, 'Vehicle pricing updated');
  }

  @Post('cars/:car_id/calendar/block')
  async blockCalendar(
    @CurrentUser('id') userId: string,
    @Param('car_id') carId: string,
    @Body() dto: BlockCalendarDto,
  ) {
    const result = await this.ownerService.blockAvailability(userId, carId, dto);
    return ApiResponse.success(result, 'Vehicle availability updated');
  }

  @Get('cars/:car_id/calendar')
  async getCalendar(
    @CurrentUser('id') userId: string,
    @Param('car_id') carId: string,
    @Query() query: GetCalendarDto,
  ) {
    const start = query.start_date ? new Date(query.start_date) : new Date();
    const end = query.end_date
      ? new Date(query.end_date)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const calendar = await this.ownerService.getAvailability(
      userId,
      carId,
      start,
      end,
    );
    return ApiResponse.success(calendar);
  }

  @Get('bookings')
  async getBookings(
    @CurrentUser('id') userId: string,
    @Query() query: PaginationDto & OwnerBookingQueryDto,
  ) {
    const { data, total, page, limit } = await this.bookingService.getBookings(
      userId,
      query,
    );
    return new PaginatedResponseDto(data, total, page, limit);
  }

  @Post('bookings/:booking_id/approve')
  async approveBooking(
    @CurrentUser('id') userId: string,
    @Param('booking_id') bookingId: string,
  ) {
    const booking = await this.bookingService.approveBooking(userId, bookingId);
    return ApiResponse.success(booking, 'Booking approved');
  }

  @Post('bookings/:booking_id/reject')
  async rejectBooking(
    @CurrentUser('id') userId: string,
    @Param('booking_id') bookingId: string,
    @Body() dto: RejectBookingDto,
  ) {
    const booking = await this.bookingService.rejectBooking(userId, bookingId, dto);
    return ApiResponse.success(booking, 'Booking declined');
  }

  @Get('finance/earnings')
  async getEarnings(
    @CurrentUser('id') userId: string,
    @Query() query?: PaginationDto,
  ) {
    const { data, total, page, limit } = await this.financeService.getEarnings(
      userId,
      query,
    );
    return new PaginatedResponseDto(data, total, page, limit);
  }

  @Get('finance/transactions')
  async getTransactions(
    @CurrentUser('id') userId: string,
    @Query() query?: PaginationDto,
  ) {
    const { data, total, page, limit } =
      await this.ownerService.getOwnerTransactions(userId, query);
    return new PaginatedResponseDto(data, total, page, limit);
  }

  @Post('finance/withdraw')
  async requestWithdraw(
    @CurrentUser('id') userId: string,
    @Body() dto: WithdrawRequestDto,
  ) {
    const withdraw = await this.financeService.requestWithdraw(userId, dto);
    return ApiResponse.success(withdraw, 'Withdrawal request submitted');
  }

  @Get('dashboard/overview')
  async getOverview(@CurrentUser('id') userId: string) {
    const data = await this.ownerService.getDashboardOverview(userId);
    return ApiResponse.success(data);
  }

  @Post('cars/:car_id/submit-review')
  async submitCarReview(
    @CurrentUser('id') userId: string,
    @Param('car_id') carId: string,
  ) {
    const car = await this.ownerService.submitCarForReview(userId, carId);
    return ApiResponse.success(car, 'Vehicle submitted for review');
  }

  @Get('wallet')
  async getWallet(@CurrentUser('id') userId: string) {
    const wallet = await this.ownerService.getWallet(userId);
    return ApiResponse.success(wallet);
  }

  @Post('disputes/:dispute_id/respond')
  async respondDispute(
    @CurrentUser('id') userId: string,
    @Param('dispute_id') disputeId: string,
    @Body() dto: RespondDisputeDto,
  ) {
    const dispute = await this.ownerService.respondDispute(
      userId,
      disputeId,
      dto.message,
    );
    return ApiResponse.success(dispute, 'Dispute response submitted');
  }

  @Get('trips')
  async getTrips(
    @CurrentUser('id') userId: string,
    @Query() query?: PaginationDto,
  ) {
    const { data, total, page, limit } = await this.ownerService.getTrips(
      userId,
      query,
    );
    return new PaginatedResponseDto(data, total, page, limit);
  }

  @Post('trips/:trip_id/checkin')
  async checkinTrip(
    @CurrentUser('id') userId: string,
    @Param('trip_id') tripId: string,
    @Body() dto: TripCheckinDto,
  ) {
    const trip = await this.ownerService.checkinTrip(userId, tripId, dto);
    return ApiResponse.success(trip, 'Vehicle pickup recorded');
  }

  @Post('trips/:trip_id/checkout')
  async checkoutTrip(
    @CurrentUser('id') userId: string,
    @Param('trip_id') tripId: string,
    @Body() dto: TripCheckoutDto,
  ) {
    const trip = await this.ownerService.checkoutTrip(userId, tripId, dto);
    return ApiResponse.success(trip, 'Vehicle return recorded');
  }
}
