import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateOwnerDisputeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  type: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bookingId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  description: string;
}
