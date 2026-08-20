import { Body, Controller, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { ApiResponse } from '../../common/dto/response.dto';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  SendOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto';

const SESSION_COOKIE = 'token';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@Public()
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return ApiResponse.success(result, 'Đăng ký tài khoản thành công');
  }

  @Post('otp/register')
  async sendRegisterOtp(@Body() dto: SendOtpDto) {
    await this.authService.sendOtp(dto, 'REGISTER');
    return ApiResponse.success(null, 'Mã OTP đăng ký đã được gửi');
  }

  @Post('verify-register-otp')
  async verifyRegisterOtp(@Body() dto: VerifyOtpDto) {
    const result = await this.authService.verifyRegisterOtp(dto);
    return ApiResponse.success(result, 'Xác thực OTP đăng ký thành công');
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setSessionCookie(response, result.token);
    return ApiResponse.success(
      { authenticated: true },
      'Đăng nhập thành công',
    );
  }

  @Post('otp/login')
  async sendLoginOtp(@Body() dto: SendOtpDto) {
    await this.authService.sendOtp(dto, 'LOGIN');
    return ApiResponse.success(null, 'Mã OTP đăng nhập đã được gửi');
  }

  @Post('verify-login-otp')
  async verifyLoginOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.verifyLoginOtp(dto);
    this.setSessionCookie(response, result.token);
    return ApiResponse.success(
      { authenticated: true },
      'Xác thực OTP đăng nhập thành công',
    );
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return ApiResponse.success(null, 'Đăng xuất thành công');
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const result = await this.authService.forgotPassword(dto);
    return ApiResponse.success(
      result,
      'Yêu cầu đặt lại mật khẩu đã được ghi nhận',
    );
  }

  @Post('otp/forgot-password')
  async sendForgotOtp(@Body() dto: SendOtpDto) {
    await this.authService.sendOtp(dto, 'FORGOT_PASSWORD');
    return ApiResponse.success(null, 'Mã OTP quên mật khẩu đã được gửi');
  }

  @Post('verify-forgot-otp')
  async verifyForgotOtp(@Body() dto: VerifyOtpDto) {
    const result = await this.authService.verifyForgotOtp(dto);
    return ApiResponse.success(result, 'Xác thực OTP quên mật khẩu thành công');
  }

  private setSessionCookie(response: Response, token: string) {
    response.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE_MS,
      path: '/',
    });
  }
}
