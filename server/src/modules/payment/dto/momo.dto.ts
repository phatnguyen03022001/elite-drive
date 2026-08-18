import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class MomoIpnDto {
  @IsString()
  @IsNotEmpty()
  partnerCode: string;

  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  requestId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  orderInfo: string;

  @IsString()
  orderType: string;

  @Type(() => Number)
  @IsNumber()
  transId: number;

  @Type(() => Number)
  @IsInt()
  resultCode: number;

  @IsString()
  message: string;

  @IsString()
  payType: string;

  @Type(() => Number)
  @IsNumber()
  responseTime: number;

  @IsString()
  extraData: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  signature: string;
}
