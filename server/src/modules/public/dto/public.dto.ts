import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class PublicCarQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter vehicles by city' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Filter by category ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ minimum: 0, description: 'Minimum daily price in VND' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ minimum: 0, description: 'Maximum daily price in VND' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ type: Date, example: '2026-08-20T00:00:00Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @ApiPropertyOptional({ type: Date, example: '2026-08-22T00:00:00Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @ApiPropertyOptional({ description: 'Transmission, for example Automatic or Manual' })
  @IsOptional()
  @IsString()
  transmission?: string;
}

export class CarIdParamDto {
  @ApiProperty({ description: 'Vehicle ID' })
  @IsString()
  car_id: string;
}

export class CarAvailabilityQueryDto {
  @ApiPropertyOptional({ type: Date })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @ApiPropertyOptional({ type: Date })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;
}

export class CarReviewQueryDto extends PaginationDto {}

export class BlogQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search term for article titles' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class BlogSlugParamDto {
  @ApiProperty({ description: 'Unique article slug' })
  @IsString()
  slug: string;
}

export class HomeQueryDto {
  @ApiPropertyOptional({ default: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  featuredCarsLimit?: number = 4;

  @ApiPropertyOptional({ default: 6 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  popularLocationsLimit?: number = 6;
}

export class PromotionQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Specific promotion code' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isActive?: boolean = true;
}

export class ReviewSummaryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  carId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;
}
