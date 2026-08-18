import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BookingStatus, KYCStatus, TripStatus, UserRole } from '@prisma/client';
import { Type } from 'class-transformer';

export class UpdateCustomerProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() avatar?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() licenseNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() licenseExpiry?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateOfBirth?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() postalCode?: string;
}

export type SharedProfileResponse = {
  id: string;
  avatar: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  postalCode: string | null;
  profileUpdatedAt: Date;
  licenseNumber?: string | null;
  licenseExpiry?: Date | null;
  dateOfBirth?: Date | null;
  licenseFrontUrl?: string | null;
  licenseBackUrl?: string | null;
  companyName?: string | null;
  taxId?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankCode?: string | null;
};

export class CustomerProfileResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() firstName: string | null;
  @ApiProperty() lastName: string | null;
  @ApiProperty() phone: string | null;
  @ApiProperty() avatar: string | null;
  @ApiProperty({ enum: UserRole }) role: UserRole;
  @ApiProperty() isActive: boolean;
  @ApiProperty() userCreatedAt: Date;
  @ApiProperty() userUpdatedAt: Date;
  @ApiProperty() profile: SharedProfileResponse;
  @ApiProperty({ enum: KYCStatus }) kycStatus: KYCStatus;
}

export class CreateKYCDto {
  @ApiProperty() @IsNotEmpty() @IsString() documentType: string;
  @ApiProperty() @IsNotEmpty() @IsString() documentNumber: string;
}

export class KYCStatusResponseDto {
  @ApiProperty({ enum: KYCStatus }) status: KYCStatus;
  @ApiPropertyOptional({ nullable: true }) documentType?: string | null;
  @ApiPropertyOptional({ nullable: true }) documentNumber?: string | null;
  @ApiPropertyOptional({ nullable: true }) documentFrontUrl?: string | null;
  @ApiPropertyOptional({ nullable: true }) documentBackUrl?: string | null;
  @ApiPropertyOptional({ nullable: true }) faceImageUrl?: string | null;
  @ApiPropertyOptional({ nullable: true }) rejectionReason?: string | null;
  @ApiPropertyOptional({ nullable: true }) submittedAt?: Date | null;
}

export class CreateBookingDto {
  @ApiProperty() @IsNotEmpty() @IsString() carId: string;
  @ApiProperty() @IsNotEmpty() @IsDateString() startDate: string;
  @ApiProperty() @IsNotEmpty() @IsDateString() endDate: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pickupLocation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dropoffLocation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class BookingQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
  @IsOptional() @IsEnum(BookingStatus) status?: BookingStatus;
}

export class BookingDetailResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() startDate: Date;
  @ApiProperty() endDate: Date;
  @ApiProperty({ enum: BookingStatus }) status: BookingStatus;
  @ApiProperty() totalPrice: number;
  @ApiProperty() car: { name: string; brand: string };
}

export class TripQueryDto {
  @ApiPropertyOptional({ enum: TripStatus }) @IsOptional() @IsEnum(TripStatus) status?: TripStatus;
}

export class TripStatusResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: TripStatus }) status: TripStatus;
  @ApiPropertyOptional() checkinTime?: Date;
  @ApiPropertyOptional() checkoutTime?: Date;
}

export class CreatePaymentDto {
  @ApiProperty() @IsNotEmpty() @IsString() bookingId: string;
  @ApiProperty({ enum: ['MOCK_QR', 'MOMO'] }) @IsString() @IsIn(['MOCK_QR', 'MOMO']) paymentMethod: string;
}

export class ConfirmPaymentDto {
  @ApiProperty() @IsNotEmpty() @IsString() bookingId: string;
  @ApiProperty() @IsNotEmpty() @IsString() transactionId: string;
}

export class PaymentBookingParamDto {
  @ApiProperty() @IsString() booking_id: string;
}

export class SignContractDto {
  @ApiProperty({ description: 'Base64 hoặc URL chữ ký' }) @IsNotEmpty() @IsString() signatureData: string;
}

export class ContractResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() bookingId: string;
  @ApiProperty() content: string;
  @ApiProperty() status: string;
  @ApiPropertyOptional() customerSignedAt?: Date;
}

export class WalletTransactionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() amount: number;
  @ApiProperty() type: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty() createdAt: Date;
}

export class CreateReviewDto {
  @ApiProperty() @IsNotEmpty() @IsString() carId: string;
  @ApiProperty() @IsNotEmpty() @IsString() bookingId: string;
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) rating: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) content?: string;
}

export class CreateWalletTopupDto {
  @Type(() => Number) @IsInt() @Min(1000) amount: number;
  @IsString() @IsIn(['MOCK_QR']) paymentMethod: string;
  @IsOptional() @IsString() description?: string;
}

export class CreateDisputeDto {
  @IsString() @IsNotEmpty() type: string;
  @IsOptional() @IsString() bookingId?: string;
  @IsString() @IsNotEmpty() title: string;
  @IsString() @IsNotEmpty() description: string;
}

export class SearchCarQueryDto {
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsOptional() @IsString() locationId?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number = 20;
}
