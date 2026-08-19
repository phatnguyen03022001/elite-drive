import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ApproveWithdrawDto {
  @ApiProperty({
    description: 'External bank/payment reference proving the payout was completed',
    example: 'BANK-20260819-000123',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  externalReference: string;
}
