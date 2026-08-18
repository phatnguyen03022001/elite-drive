import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuthService OTP attempt limit', () => {
  it('locks an active OTP after five failed verification attempts', async () => {
    let attempts = 4;
    const prisma = {
      oTP: {
        findFirst: jest.fn(async () => ({
          id: 'otp-1',
          code: 'a'.repeat(64),
          attempts,
        })),
        update: jest.fn(async ({ data }: { data: { attempts: number } }) => {
          attempts = data.attempts;
          return { id: 'otp-1', attempts };
        }),
        deleteMany: jest.fn(),
      },
    } as unknown as PrismaService;
    const config = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'OTP_HASH_SECRET') return 'test-secret';
        if (key === 'JWT_SECRET') return 'jwt-secret';
        throw new Error(`unexpected config ${key}`);
      }),
    } as unknown as ConfigService;

    const service = new AuthService(
      prisma,
      {} as JwtService,
      config,
      {} as MailService,
    );

    await expect(
      service.verifyForgotOtp({ email: 'user@example.com', code: '123456' }),
    ).rejects.toMatchObject<HttpException>({ status: 429 });
    expect(attempts).toBe(5);
    expect((prisma.oTP.update as jest.Mock).mock.calls).toHaveLength(1);
  });
});
