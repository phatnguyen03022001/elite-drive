import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  ApiResponse,
  PaginatedResponseDto,
} from '../../common/dto/response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CarAvailabilityQueryDto,
  CarReviewQueryDto,
  PromotionQueryDto,
  PublicCarQueryDto,
} from './dto/public.dto';
import { PublicService } from './public.service';

@Controller('api')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(
    @CurrentUser('id') userId: string,
  ): Promise<ApiResponse<unknown>> {
    const profile = await this.publicService.getProfile(userId);
    return ApiResponse.success(profile);
  }

  @Public()
  @Get('promotions')
  async getPromotions(@Query() query: PromotionQueryDto) {
    const promotions = await this.publicService.getPromotions(query);
    return ApiResponse.success(promotions);
  }

  @Public()
  @Get('cars')
  async getCars(@Query() query: PublicCarQueryDto) {
    const { data, total, page, limit } = await this.publicService.getCars(query);
    const publicCars = data.map((car) => ({
      id: car.id,
      name: car.name,
      mainImageUrl: car.mainImageUrl,
      pricePerDay: car.pricePerDay,
      transmission: car.transmission,
      seatCount: car.seatCount,
      averageRating: car.averageRating,
      location: car.location
        ? { name: car.location.name, city: car.location.city }
        : null,
    }));
    return new PaginatedResponseDto(publicCars, total, page, limit);
  }

  @Public()
  @Get('cars/:car_id')
  async getCarDetail(@Param('car_id') carId: string) {
    const car = await this.publicService.getCarDetail(carId);
    return ApiResponse.success({
      id: car.id,
      name: car.name,
      mainImageUrl: car.mainImageUrl,
      averageRating: car.averageRating,
      pricePerDay: car.pricePerDay,
      year: car.year,
      transmission: car.transmission,
      seatCount: car.seatCount,
      fuelType: car.fuelType,
      color: car.color,
      description: car.description,
      category: car.category
        ? { name: car.category.name, slug: car.category.slug }
        : null,
      location: car.location
        ? { name: car.location.name, city: car.location.city }
        : null,
      owner: car.owner
        ? {
            firstName: car.owner.firstName,
            lastName: car.owner.lastName,
            _count: car.owner._count,
          }
        : null,
      hasInsuranceDocument: car.documents.length > 0,
    });
  }

  @Public()
  @Get('cars/:car_id/availability')
  async getCarAvailability(
    @Param('car_id') carId: string,
    @Query() query: CarAvailabilityQueryDto,
  ) {
    const availability = await this.publicService.getCarAvailability(carId, query);
    return ApiResponse.success(availability);
  }

  @Public()
  @Get('cars/:car_id/reviews')
  async getCarReviews(
    @Param('car_id') carId: string,
    @Query() query: CarReviewQueryDto,
  ) {
    const { data, total, page, limit } = await this.publicService.getCarReviews(
      carId,
      query,
    );
    const publicReviews = data.map((review) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      content: review.content,
      createdAt: review.createdAt,
      customer: review.customer,
    }));
    return new PaginatedResponseDto(publicReviews, total, page, limit);
  }

  @Public()
  @Get('reviews/summary')
  async getReviewSummary() {
    const summary = await this.publicService.getReviewSummary();
    return ApiResponse.success(summary);
  }
}
