import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const OTP_PATTERN = /^\d{6}$/;

export class SendOtpDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email nhận mã OTP',
  })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  @MaxLength(254)
  email: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: '123456', description: 'Mã OTP gồm 6 chữ số' })
  @IsString()
  @IsNotEmpty({ message: 'Mã OTP không được để trống' })
  @Length(6, 6, { message: 'Mã OTP phải có đúng 6 ký tự' })
  @Matches(OTP_PATTERN, { message: 'Mã OTP phải gồm đúng 6 chữ số' })
  code: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải từ 8 ký tự' })
  @MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự' })
  password: string;

  @ApiPropertyOptional({ example: '123456' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  @Matches(OTP_PATTERN)
  otp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ enum: ['CUSTOMER', 'OWNER'], default: 'CUSTOMER' })
  @IsOptional()
  @IsEnum(['CUSTOMER', 'OWNER'], { message: 'Role không hợp lệ' })
  role?: 'CUSTOMER' | 'OWNER';
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @MaxLength(128, { message: 'Mật khẩu đăng nhập quá dài' })
  password: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty({ message: 'Mã OTP là bắt buộc' })
  @Length(6, 6)
  @Matches(OTP_PATTERN, { message: 'Mã OTP phải gồm đúng 6 chữ số' })
  code: string;

  @ApiProperty({ example: 'newpassword123', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới phải từ 8 ký tự' })
  @MaxLength(72, { message: 'Mật khẩu mới tối đa 72 ký tự' })
  newPassword: string;
}
