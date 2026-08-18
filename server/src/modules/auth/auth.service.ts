// src/modules/auth/auth.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  TooManyRequestsException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHmac, randomInt } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';

import {
  RegisterDto,
  SendOtpDto,
  LoginDto,
  ForgotPasswordDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  private static readonly OTP_TTL_MS = 5 * 60 * 1000;
  private static readonly OTP_RESEND_COOLDOWN_MS = 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async sendOtp(
    dto: SendOtpDto,
    type: 'REGISTER' | 'LOGIN' | 'FORGOT_PASSWORD',
  ) {
    if (type === 'LOGIN' || type === 'FORGOT_PASSWORD') {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email },
        select: { id: true },
      });

      // Return the same response for unknown accounts to avoid account enumeration.
      if (!user) return this.otpSentResponse(type);
    }

    await this.createOtp(dto.email, type);
    return this.otpSentResponse(type);
  }

  async register(dto: RegisterDto) {
    const existed = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existed && existed.isVerified) {
      throw new ConflictException('Email đã tồn tại và đã được xác thực');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const selectedRole = dto.role || 'CUSTOMER';

    let user;

    if (existed && !existed.isVerified) {
      user = await this.prisma.user.update({
        where: { email: dto.email },
        data: {
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          role: selectedRole,
        },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          role: selectedRole,
          isVerified: false,
        },
      });
    }

    await this.sendOtp({ email: dto.email }, 'REGISTER');

    return {
      message: 'Đăng ký thành công. Vui lòng kiểm tra email để xác nhận OTP',
      userId: user.id,
    };
  }

  async verifyRegisterOtp(dto: VerifyOtpDto) {
    await this.consumeOtp(dto.email, dto.code, 'REGISTER');

    await this.prisma.user.updateMany({
      where: { email: dto.email, isVerified: false },
      data: { isVerified: true },
    });

    return { message: 'Xác thực đăng ký thành công!' };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException(
        'Tài khoản chưa được xác thực. Vui lòng kiểm tra email và xác nhận OTP',
      );
    }

    return this.generateTokens(user);
  }

  async verifyLoginOtp(dto: VerifyOtpDto) {
    await this.consumeOtp(dto.email, dto.code, 'LOGIN');

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) throw new NotFoundException('Tài khoản không tồn tại');

    return this.generateTokens(user);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    await this.consumeOtp(dto.email, dto.code, 'FORGOT_PASSWORD');

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { email: dto.email },
      data: { password: hashedPassword },
    });

    return { message: 'Mật khẩu đã được cập nhật thành công' };
  }

  async verifyForgotOtp(dto: VerifyOtpDto) {
    await this.assertOtpValid(dto.email, dto.code, 'FORGOT_PASSWORD');

    return {
      message: 'OTP hợp lệ, bạn có thể đặt lại mật khẩu',
      email: dto.email,
    };
  }

  private otpSentResponse(type: string) {
    const action =
      type === 'REGISTER'
        ? 'đăng ký'
        : type === 'LOGIN'
          ? 'đăng nhập'
          : 'đặt lại mật khẩu';

    return { message: `Nếu email hợp lệ, OTP ${action} sẽ được gửi` };
  }

  private async createOtp(email: string, type: string) {
    const previousOtp = await this.prisma.oTP.findFirst({
      where: { email, type },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (
      previousOtp &&
      Date.now() - previousOtp.createdAt.getTime() <
        AuthService.OTP_RESEND_COOLDOWN_MS
    ) {
      throw new TooManyRequestsException(
        'Vui lòng chờ trước khi yêu cầu OTP mới',
      );
    }

    const code = randomInt(100000, 1000000).toString();
    const codeDigest = this.hashOtp(email, type, code);

    await this.prisma.oTP.deleteMany({ where: { email, type } });

    await this.prisma.oTP.create({
      data: {
        email,
        code: codeDigest,
        type,
        expiresAt: new Date(Date.now() + AuthService.OTP_TTL_MS),
      },
    });

    await this.mailService.sendOtp(email, code, type);
  }

  private async assertOtpValid(email: string, code: string, type: string) {
    const codeDigest = this.hashOtp(email, type, code);
    const otp = await this.prisma.oTP.findFirst({
      where: {
        email,
        code: codeDigest,
        type,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (!otp) {
      throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn');
    }
  }

  private async consumeOtp(email: string, code: string, type: string) {
    const codeDigest = this.hashOtp(email, type, code);
    const result = await this.prisma.oTP.deleteMany({
      where: {
        email,
        code: codeDigest,
        type,
        expiresAt: { gt: new Date() },
      },
    });

    if (result.count !== 1) {
      throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn');
    }
  }

  private hashOtp(email: string, type: string, code: string) {
    const secret = this.config.getOrThrow<string>('OTP_HASH_SECRET');
    return createHmac('sha256', secret)
      .update(`${email.toLowerCase()}:${type}:${code}`)
      .digest('hex');
  }

  private generateTokens(user: { id: string; email: string; role: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn: '7d',
    });
    return { token };
  }
}
