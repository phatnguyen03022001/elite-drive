import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsDateString,
  IsOptional,
  IsBoolean,
  IsBooleanString,
  IsEnum,
  IsUrl,
  IsIn,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  PaymentStatus,
  SettlementStatus,
  KYCStatus,
  DisputeStatus,
} from '@prisma/client';

// --- GROUP 1: REPORTS & ANALYTICS ---

export class ReportDateRangeDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}

export class AdminReportOverviewDto {
  @ApiProperty() totalUsers: number;
  @ApiProperty() totalCars: number;
  @ApiProperty() activeBookings: number;
  @ApiProperty() totalRevenue: number;
}

export class AdminRevenueReportDto {
  @ApiProperty() date: string;
  @ApiProperty() revenue: number;
  @ApiProperty() completedBookings: number;
}

export class AdminBookingReportDto {
  @ApiProperty() status: string;
  @ApiProperty() count: number;
  @ApiProperty() percentage: number;
}

// --- GROUP 2: PROMOTIONS ---

export class CreatePromotionDto {
  @ApiProperty({ example: 'SUMMER2026' })
  @IsNotEmpty()
  @IsString()
  code: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiProperty({ example: 'PERCENTAGE', description: 'PERCENTAGE hoặc FIXED' })
  @IsNotEmpty()
  @IsString()
  discountType: string;
  @ApiProperty() @IsNotEmpty() @IsNumber() discountValue: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() maxUses?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() minBookingAmount?: number;
  @ApiProperty() @IsNotEmpty() @IsDateString() startDate: string;
  @ApiProperty() @IsNotEmpty() @IsDateString() endDate: string;
}

export class UpdatePromotionDto extends PartialType(CreatePromotionDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class PromotionQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsBooleanString() isActive?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() page?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() limit?: string;
}

// --- GROUP 3: PAYMENTS & SETTLEMENTS ---

export class RunSettlementDto {
  @ApiProperty({ example: '2026-01' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'period phải có dạng YYYY-MM' })
  period: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;
}

export class PaymentQueryDto {
  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}

export class ReleasePaymentDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  bookingId: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  platformFeePercent?: number;
}

export class RefundPaymentDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  bookingId: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  refundPercent?: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class SettlementResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() period: string;
  @ApiProperty() totalEarnings: number;
  @ApiProperty() totalPayouts: number;
  @ApiProperty() netAmount: number;
  @ApiProperty({ enum: SettlementStatus }) status: SettlementStatus;
  @ApiProperty() processedAt: Date | null;
}

export class SettlementHistoryQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() period?: string;
  @ApiPropertyOptional({ enum: SettlementStatus })
  @IsOptional()
  @IsEnum(SettlementStatus)
  status?: SettlementStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerId?: string;
}

// --- GROUP 4: KYC & CAR APPROVAL ---

export class AdminKYCQueryDto {
  @ApiPropertyOptional({ enum: KYCStatus })
  @IsOptional()
  @IsEnum(KYCStatus)
  status?: KYCStatus;
}

export class RejectKYCDto {
  @ApiProperty() @IsNotEmpty() @IsString() rejectionReason: string;
}

export class AdminKYCResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty({ enum: KYCStatus }) status: KYCStatus;
  @ApiProperty() documentType: string | null;
  @ApiProperty() documentImageUrl: string | null;
  @ApiProperty() faceImageUrl: string | null;
  @ApiProperty() submittedAt: Date;
  @ApiProperty() user: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export class ApproveCarDto {
  @ApiProperty() @IsNotEmpty() @IsString() carId: string;
}

export class PendingCarResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() licensePlate: string;
  @ApiProperty() ownerId: string;
  @ApiProperty() verificationStatus: string;
  @ApiProperty() documents: unknown[];
  @ApiProperty() createdAt: Date;
}

// --- GROUP 5: DISPUTES & MASTER DATA ---

export class ResolveDisputeDto {
  @ApiProperty() @IsNotEmpty() @IsString() resolution: string;
  @ApiProperty({ enum: DisputeStatus })
  @IsNotEmpty()
  @IsEnum(DisputeStatus)
  status: DisputeStatus;
}

export class DisputeQueryDto {
  @ApiPropertyOptional({ enum: DisputeStatus })
  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus;
}

export class CreateCategoryDto {
  @ApiProperty() @IsNotEmpty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl() imageUrl?: string;
}

export class CreateLocationDto {
  @ApiProperty() @IsNotEmpty() @IsString() name: string;
  @ApiProperty() @IsNotEmpty() @IsString() address: string;
  @ApiProperty() @IsNotEmpty() @IsString() city: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() longitude?: number;
}

export class UpdateUserStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] })
  @IsIn(['ACTIVE', 'INACTIVE'])
  status: 'ACTIVE' | 'INACTIVE';
}

export class RejectWithdrawDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  reason: string;
}
