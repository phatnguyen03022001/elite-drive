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
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2048) avatar?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) licenseNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() licenseExpiry?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateOfBirth?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) postalCode?: string;
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
  @ApiProperty() @IsNotEmpty() @IsString() @MaxLength(50) documentType: string;
  @ApiProperty() @IsNotEmpty() @IsString() @MaxLength(100) documentNumber: string;
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
  @ApiProperty() @IsNotEmpty() @IsString() @MaxLength(64) carId: string;
  @ApiProperty() @IsNotEmpty() @IsDateString() startDate: string;
  @ApiProperty() @IsNotEmpty() @IsDateString() endDate: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) pickupLocation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) dropoffLocation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class BookingQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
  @IsOptional() @IsEnum(BookingStatus) status?: BookingStatus;
}

export class BookingDetailResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() carId: string;
  @ApiProperty() startDate: Date;
  @ApiProperty() endDate: Date;
  @ApiPropertyOptional({ nullable: true }) pickupLocation?: string | null;
  @ApiPropertyOptional({ nullable: true }) dropoffLocation?: string | null;
  @ApiPropertyOptional({ nullable: true }) decisionReason?: string | null;
  @ApiProperty({ enum: BookingStatus }) status: BookingStatus;
  @ApiProperty() totalPrice: number;
  @ApiPropertyOptional({ nullable: true }) discountAmount?: number | null;
  @ApiPropertyOptional({ nullable: true }) finalPrice?: number | null;
  @ApiProperty()
  car: {
    id: string;
    name: string;
    brand: string;
    mainImageUrl: string | null;
  };
  @ApiPropertyOptional({ nullable: true })
  contract?: {
    status: string;
    customerSignedAt: Date | null;
  } | null;
  @ApiPropertyOptional({ type: [Object] }) reviews?: Array<{ id: string }>;
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
  @ApiProperty() @IsNotEmpty() @IsString() @MaxLength(64) bookingId: string;
  @ApiProperty({ enum: ['MOCK_QR', 'MOMO'] }) @IsString() @IsIn(['MOCK_QR', 'MOMO']) paymentMethod: string;
}

export class ConfirmPaymentDto {
  @ApiProperty() @IsNotEmpty() @IsString() @MaxLength(64) bookingId: string;
  @ApiProperty() @IsNotEmpty() @IsString() @MaxLength(128) transactionId: string;
}

export class PaymentBookingParamDto {
  @ApiProperty() @IsString() @MaxLength(64) booking_id: string;
}

export class SignContractDto {
  @ApiProperty({ description: 'Base64 hoặc URL chữ ký' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200000)
  signatureData: string;
}

export class ContractResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() bookingId: string;
  @ApiProperty() content: string;
  @ApiProperty() status: string;
  @ApiPropertyOptional({ nullable: true }) customerSignedAt?: Date | null;
}

export class WalletTransactionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() amount: number;
  @ApiProperty() type: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty() createdAt: Date;
}

export class CreateReviewDto {
  @ApiProperty() @IsNotEmpty() @IsString() @MaxLength(64) carId: string;
  @ApiProperty() @IsNotEmpty() @IsString() @MaxLength(64) bookingId: string;
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) rating: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) content?: string;
}

export class CreateWalletTopupDto {
  @Type(() => Number) @IsInt() @Min(1000) amount: number;
  @IsString() @IsIn(['MOCK_QR']) paymentMethod: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}

export class CreateDisputeDto {
  @IsString() @IsNotEmpty() @MaxLength(50) type: string;
  @IsOptional() @IsString() @MaxLength(64) bookingId?: string;
  @IsString() @IsNotEmpty() @MaxLength(200) title: string;
  @IsString() @IsNotEmpty() @MaxLength(4000) description: string;
}

export class SearchCarQueryDto {
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsOptional() @IsString() @MaxLength(64) locationId?: string;
  @IsOptional() @IsString() @MaxLength(64) categoryId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number = 20;
}
