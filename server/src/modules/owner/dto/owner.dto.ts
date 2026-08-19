import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateKYCDto {
  @ApiProperty() @IsNotEmpty() @IsString() @MaxLength(50) documentType: string;
  @ApiProperty() @IsNotEmpty() @IsString() @MaxLength(100) documentNumber: string;
}

export class KYCStatusResponseDto {
  @ApiProperty({ enum: ['NONE', 'PENDING', 'APPROVED', 'REJECTED'] })
  status: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  @ApiPropertyOptional() documentType?: string;
  @ApiPropertyOptional() documentNumber?: string;
  @ApiPropertyOptional() documentFrontUrl?: string;
  @ApiPropertyOptional() documentBackUrl?: string;
  @ApiPropertyOptional() faceImageUrl?: string;
  @ApiPropertyOptional() rejectionReason?: string;
  @ApiPropertyOptional() submittedAt?: Date | null;
}

export class CreateCarDto {
  @ApiProperty({ example: 'VinFast VF8' }) @IsNotEmpty() @IsString() @MaxLength(120) name: string;
  @ApiProperty({ example: 'VinFast' }) @IsNotEmpty() @IsString() @MaxLength(80) brand: string;
  @ApiProperty({ example: 'Plus' }) @IsNotEmpty() @IsString() @MaxLength(80) model: string;
  @ApiProperty({ example: 2023 }) @IsInt() @Min(1900) @Max(2100) @Type(() => Number) year: number;
  @ApiProperty({ example: '51H-123.45' }) @IsNotEmpty() @IsString() @MaxLength(30) licensePlate: string;
  @ApiPropertyOptional({ example: 'Trắng' }) @IsOptional() @IsString() @MaxLength(50) color?: string;
  @ApiPropertyOptional({ example: 'Automatic' }) @IsOptional() @IsString() @MaxLength(50) transmission?: string;
  @ApiPropertyOptional({ example: 'Electric' }) @IsOptional() @IsString() @MaxLength(50) fuelType?: string;
  @ApiProperty({ example: 5 }) @IsInt() @Min(1) @Max(100) @Type(() => Number) seatCount: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiProperty({ example: 1000000 }) @Type(() => Number) @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER) pricePerDay: number;
  @ApiPropertyOptional({ example: 50000 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) pricePerHour?: number;
  @ApiPropertyOptional({ example: 5000000 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) pricePerWeek?: number;
  @ApiPropertyOptional({ example: 15000000 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) pricePerMonth?: number;
  @ApiPropertyOptional({ description: 'ID danh mục xe' }) @IsOptional() @IsString() @MaxLength(64) categoryId?: string;
  @ApiPropertyOptional({ description: 'ID vị trí xe' }) @IsOptional() @IsString() @MaxLength(64) locationId?: string;
}

export class UpdateCarDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) brand?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) model?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1900) @Max(2100) year?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) licensePlate?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) seatCount?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER) pricePerDay?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) pricePerHour?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) locationId?: string;
}

export class CreateCarDocumentDto {
  @ApiProperty({ description: 'Ví dụ: Bảo hiểm, Đăng kiểm' }) @IsNotEmpty() @IsString() @MaxLength(50) documentType: string;
  @ApiProperty() @IsNotEmpty() @IsUrl({ require_protocol: true }) @MaxLength(2048) documentUrl: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiryDate?: string;
}

export class CarDocumentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() carId: string;
  @ApiProperty() documentType: string;
  @ApiProperty() documentUrl: string;
  @ApiProperty() expiryDate: Date | null;
  @ApiProperty() uploadedAt: Date;
}

export class CreatePricingDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER) pricePerDay: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) pricePerHour?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) pricePerWeek?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) pricePerMonth?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) discountPercentage?: number;
}

export class BlockCalendarDto {
  @ApiProperty({ example: '2026-02-14' }) @IsNotEmpty() @IsDateString() date: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) blockedReason?: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isBlocked?: boolean;
}

export class GetCalendarDto {
  @IsOptional() @IsDateString() start_date?: string;
  @IsOptional() @IsDateString() end_date?: string;
}

export class CalendarResponseDto {
  @ApiProperty() date: Date;
  @ApiProperty() isBlocked: boolean;
  @ApiProperty() blockedReason: string | null;
}

export class TripCheckinDto {
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) startOdometer: number;
  @ApiProperty({ description: 'Phần trăm pin hoặc vạch xăng' }) @Type(() => Number) @IsNumber() @Min(0) @Max(100) startFuelLevel: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) pickupNotes?: string;
}

export class TripCheckoutDto {
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) endOdometer: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) @Max(100) endFuelLevel: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) dropoffNotes?: string;
}

export class OwnerBookingQueryDto {
  @ApiPropertyOptional({ enum: BookingStatus }) @IsOptional() @IsEnum(BookingStatus) status?: BookingStatus;
}

export class RejectBookingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

export class WithdrawRequestDto {
  @ApiProperty({ example: 500000 }) @Type(() => Number) @IsInt() @Min(50000) @Max(Number.MAX_SAFE_INTEGER) amount: number;
  @ApiProperty({ description: 'UUID generated once per user withdrawal action' }) @IsUUID('4') idempotencyKey: string;
  @ApiProperty() @IsNotEmpty() @IsString() @MaxLength(100) bankAccountNumber: string;
  @ApiProperty() @IsNotEmpty() @IsString() @MaxLength(200) bankAccountName: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
}

export class RespondDisputeDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(4000) message: string;
}

export class EarningResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() bookingId: string | null;
  @ApiProperty() amount: number;
  @ApiProperty({ description: 'RENTAL_INCOME, COMPENSATION' }) type: string;
  @ApiProperty() createdAt: Date;
}

export class TransactionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() amount: number;
  @ApiProperty({ description: 'WITHDRAWAL, EARNING' }) type: string;
  @ApiProperty({ description: 'PENDING, COMPLETED, FAILED' }) status: string;
  @ApiProperty() createdAt: Date;
}

export class UpdateOwnerProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) companyName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) taxId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) bankAccountName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) bankAccountNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) bankCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) country?: string;
}

export class OwnerProfileResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty() companyName: string | null;
  @ApiProperty() taxId: string | null;
  @ApiProperty() bankAccountName: string | null;
  @ApiProperty() bankAccountNumber: string | null;
  @ApiProperty() bankCode: string | null;
  @ApiProperty() address: string | null;
  @ApiProperty() city: string | null;
  @ApiProperty() country: string | null;
  @ApiProperty() verificationStatus: string;
  @ApiProperty() user: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  };
}
