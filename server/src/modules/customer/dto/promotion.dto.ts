import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ApplyPromotionDto {
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  promoCode: string;
}
