import { HttpException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { createHmac } from 'crypto';
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

  const digest = (email: string, type: string, code: string) =>
    createHmac('sha256', 'test-secret')
      .update(`${email.toLowerCase()}:${type}:${code}`)
      .digest('hex');

  it('atomically locks an active OTP after five failed verification attempts', async () => {
    let attempts = 4;
    const expiresAt = new Date(Date.now() + 60_000);
    const storedCode = 'a'.repeat(64);
    const prisma = {
      oTP: {
        findFirst: jest.fn(async () => ({
          id: 'otp-1',
          code: storedCode,
          attempts,
        })),
        updateMany: jest.fn(async () => {
          if (attempts >= 5) return { count: 0 };
          attempts += 1;
          return { count: 1 };
        }),
        findUnique: jest.fn(async () => ({ attempts, expiresAt })),
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
    expect((prisma.oTP.updateMany as jest.Mock)).toHaveBeenCalledWith({
      where: {
        id: 'otp-1',
        code: storedCode,
        expiresAt: { gt: expect.any(Date) },
        attempts: { lt: 5 },
      },
      data: { attempts: { increment: 1 } },
    });
  });

  it('does not lose OTP attempts when wrong codes race', async () => {
    let attempts = 3;
    const expiresAt = new Date(Date.now() + 60_000);
    const prisma = {
      oTP: {
        findFirst: jest.fn(async () => ({
          id: 'otp-race',
          code: 'b'.repeat(64),
          attempts,
        })),
        updateMany: jest.fn(async () => {
          await Promise.resolve();
          if (attempts >= 5) return { count: 0 };
          attempts += 1;
          return { count: 1 };
        }),
        findUnique: jest.fn(async () => ({ attempts, expiresAt })),
      },
    } as unknown as PrismaService;
    const service = new AuthService(
      prisma,
      {} as JwtService,
      config,
      {} as MailService,
    );

    const results = await Promise.allSettled([
      service.verifyForgotOtp({ email: 'user@example.com', code: '111111' }),
      service.verifyForgotOtp({ email: 'user@example.com', code: '222222' }),
    ]);

    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(attempts).toBe(5);
  });

  it('does not charge a wrong attempt from an old OTP against a rotated OTP', async () => {
    const oldDigest = 'c'.repeat(64);
    const expiresAt = new Date(Date.now() + 60_000);
    const prisma = {
      oTP: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'otp-rotated',
          code: oldDigest,
          attempts: 0,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({ attempts: 0, expiresAt }),
      },
    } as unknown as PrismaService;
    const service = new AuthService(
      prisma,
      {} as JwtService,
      config,
      {} as MailService,
    );

    await expect(
      service.verifyForgotOtp({ email: 'user@example.com', code: '999999' }),
    ).rejects.toThrow('OTP không hợp lệ hoặc đã hết hạn');
    expect(prisma.oTP.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ code: oldDigest }),
      }),
    );
  });

  it('binds OTP consumption to the exact digest that was validated', async () => {
    const email = 'user@example.com';
    const code = '123456';
    const storedDigest = digest(email, 'REGISTER', code);
    const prisma = {
      oTP: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'otp-1',
          code: storedDigest,
          attempts: 0,
        }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      user: { updateMany: jest.fn() },
    } as unknown as PrismaService;
    const service = new AuthService(
      prisma,
      {} as JwtService,
      config,
      {} as MailService,
    );

    await expect(
      service.verifyRegisterOtp({ email, code }),
    ).rejects.toThrow('OTP đã được xử lý hoặc đã hết hạn');
    expect(prisma.oTP.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'otp-1',
        code: storedDigest,
        attempts: { lt: 5 },
        expiresAt: { gt: expect.any(Date) },
      },
    });
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('allows only one concurrent resend claimant to send an OTP', async () => {
    const oldCreatedAt = new Date(Date.now() - 120_000);
    let currentCreatedAt = oldCreatedAt;
    const mail = { sendOtp: jest.fn().mockResolvedValue(undefined) };
    const prisma = {
      oTP: {
        findFirst: jest.fn(async () => ({
          id: 'legacy-otp',
          createdAt: currentCreatedAt,
        })),
        updateMany: jest.fn(async ({ where, data }) => {
          await Promise.resolve();
          if (where.createdAt.getTime() !== currentCreatedAt.getTime()) {
            return { count: 0 };
          }
          currentCreatedAt = data.createdAt;
          return { count: 1 };
        }),
      },
    } as unknown as PrismaService;
    const service = new AuthService(
      prisma,
      {} as JwtService,
      config,
      mail as unknown as MailService,
    );

    const results = await Promise.allSettled([
      service.sendOtp({ email: 'new@example.com' }, 'REGISTER'),
      service.sendOtp({ email: 'new@example.com' }, 'REGISTER'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(mail.sendOtp).toHaveBeenCalledTimes(1);
  });

  it('uses a deterministic fallback record when concurrent first OTP creation collides', async () => {
    let created = false;
    const duplicate = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: '6.19.0',
    });
    const mail = { sendOtp: jest.fn().mockResolvedValue(undefined) };
    const prisma = {
      oTP: {
        findFirst: jest.fn(async () =>
          created
            ? { id: 'stable-otp', createdAt: new Date() }
            : null,
        ),
        create: jest.fn(async () => {
          if (created) throw duplicate;
          created = true;
          return { id: 'stable-otp' };
        }),
      },
    } as unknown as PrismaService;
    const service = new AuthService(
      prisma,
      {} as JwtService,
      config,
      mail as unknown as MailService,
    );

    const results = await Promise.allSettled([
      service.sendOtp({ email: 'race@example.com' }, 'REGISTER'),
      service.sendOtp({ email: 'race@example.com' }, 'REGISTER'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(mail.sendOtp).toHaveBeenCalledTimes(1);
    const firstCreate = (prisma.oTP.create as jest.Mock).mock.calls[0][0].data;
    expect(firstCreate.id).toMatch(/^[a-f0-9]{24}$/);
  });

  it('does not expose account existence through login OTP resend cooldown', async () => {
    const recent = new Date();
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }) },
      oTP: {
        findFirst: jest.fn().mockResolvedValue({ id: 'otp-1', createdAt: recent }),
      },
    } as unknown as PrismaService;
    const service = new AuthService(
      prisma,
      {} as JwtService,
      config,
      {} as MailService,
    );

    await expect(
      service.sendOtp({ email: 'known@example.com' }, 'LOGIN'),
    ).resolves.toEqual({
      message: 'Nếu email hợp lệ, OTP đăng nhập sẽ được gửi',
    });
  });

  it('atomically counts concurrent password failures against one active guard', async () => {
    let attempts = 3;
    const expiresAt = new Date(Date.now() + 60_000);
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      oTP: {
        findFirst: jest.fn(async () => ({ id: 'login-guard', attempts })),
        updateMany: jest.fn(async () => {
          await Promise.resolve();
          if (attempts >= 5) return { count: 0 };
          attempts += 1;
          return { count: 1 };
        }),
        findUnique: jest.fn(async () => ({ attempts, expiresAt })),
      },
    } as unknown as PrismaService;
    const service = new AuthService(
      prisma,
      {} as JwtService,
      config,
      {} as MailService,
    );

    const results = await Promise.allSettled([
      service.login({ email: 'unknown@example.com', password: 'wrong-password' }),
      service.login({ email: 'unknown@example.com', password: 'wrong-password' }),
    ]);

    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(attempts).toBe(5);
  });

  it('cleans expired legacy login guards before deterministic first-guard creation', async () => {
    let attempts = 0;
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      oTP: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(async () => {
          attempts = 1;
          return { id: 'new-guard' };
        }),
      },
    } as unknown as PrismaService;
    const service = new AuthService(
      prisma,
      {} as JwtService,
      config,
      {} as MailService,
    );

    await expect(
      service.login({ email: 'legacy@example.com', password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.oTP.deleteMany).toHaveBeenCalledWith({
      where: {
        email: 'legacy@example.com',
        type: 'LOGIN_PASSWORD_GUARD',
        expiresAt: { lte: expect.any(Date) },
      },
    });
    expect(attempts).toBe(1);
  });

  it('locks password login after five failed attempts using the shared database counter', async () => {
    let attempts = 0;
    const expiresAt = new Date(Date.now() + 60_000);
    const prisma = {
      user: {
        findUnique: jest.fn(async () => null),
      },
      oTP: {
        findFirst: jest.fn(async () =>
          attempts === 0 ? null : { id: 'login-guard', attempts },
        ),
        updateMany: jest.fn(async ({ where, data }) => {
          if (where.id && where.expiresAt?.lte) return { count: 0 };
          if (attempts >= 5) return { count: 0 };
          if (data.attempts?.increment) attempts += 1;
          return { count: 1 };
        }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn(async () => {
          attempts = 1;
          return { id: 'login-guard', attempts };
        }),
        findUnique: jest.fn(async () => ({ attempts, expiresAt })),
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
    ).rejects.toBeInstanceOf(HttpException);
    expect(attempts).toBe(5);
  });

  it('keeps the login guard when a correct password belongs to an inactive account', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'user@example.com',
          password: 'hash',
          role: 'CUSTOMER',
          isActive: false,
          isVerified: true,
        }),
      },
      oTP: {
        findFirst: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn(),
      },
    } as unknown as PrismaService;
    const service = new AuthService(
      prisma,
      {} as JwtService,
      config,
      {} as MailService,
    );
    jest.spyOn(require('bcrypt'), 'compare').mockResolvedValueOnce(true);

    await expect(
      service.login({ email: 'user@example.com', password: 'correct-password' }),
    ).rejects.toThrow('Tài khoản đã bị vô hiệu hóa');
    expect(prisma.oTP.deleteMany).not.toHaveBeenCalled();
  });
});
