import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuthService abuse protection', () => {
  const config = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'OTP_HASH_SECRET') return 'test-secret';
      if (key === 'JWT_SECRET') return 'jwt-secret';
      throw new Error(`unexpected config ${key}`);
    }),
  } as unknown as ConfigService;

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

    const service = new AuthService(
      prisma,
      {} as JwtService,
      config,
      {} as MailService,
    );

    await expect(
      service.verifyForgotOtp({ email: 'user@example.com', code: '123456' }),
    ).rejects.toMatchObject({ status: 429 });
    expect(attempts).toBe(5);
    expect((prisma.oTP.update as jest.Mock).mock.calls).toHaveLength(1);
  });

  it('locks password login after five failed attempts using the shared database counter', async () => {
    let attempts = 0;
    const prisma = {
      user: {
        findUnique: jest.fn(async () => null),
      },
      oTP: {
        findFirst: jest.fn(async () =>
          attempts === 0 ? null : { id: 'login-guard', attempts },
        ),
        create: jest.fn(async () => {
          attempts = 1;
          return { id: 'login-guard', attempts };
        }),
        update: jest.fn(async () => {
          attempts += 1;
          return { attempts };
        }),
        deleteMany: jest.fn(),
      },
    } as unknown as PrismaService;

    const service = new AuthService(
      prisma,
      {} as JwtService,
      config,
      {} as MailService,
    );

    for (let index = 0; index < 4; index += 1) {
      await expect(
        service.login({ email: 'unknown@example.com', password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }

    await expect(
      service.login({ email: 'unknown@example.com', password: 'wrong-password' }),
    ).rejects.toMatchObject({ status: 429 });
    expect(attempts).toBe(5);
  });
});
