import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { createHmac } from 'node:crypto';
import {
  UserRole,
  VerificationStatus,
} from '@prisma/client';
import {
  createIntegrationApp,
  resetIntegrationDatabase,
} from './test-database';

describe('real Nest HTTP password recovery', () => {
  let app: Awaited<ReturnType<typeof createIntegrationApp>>['app'];
  let prisma: Awaited<ReturnType<typeof createIntegrationApp>>['prisma'];

  const email = 'integration.recovery@example.com';
  const oldPassword = 'OldPassword!2026';
  const newPassword = 'NewPassword!2026';
  const replayPassword = 'ReplayPassword!2026';
  const code = '123456';
  const userId = '507f1f77bcf86cd799439198';
  const otpId = '507f1f77bcf86cd799439199';

  beforeAll(async () => {
    ({ app, prisma } = await createIntegrationApp());
  });

  beforeEach(async () => {
    await resetIntegrationDatabase(prisma);

    const oldHash = await bcrypt.hash(oldPassword, 10);
    await prisma.user.create({
      data: {
        id: userId,
        email,
        password: oldHash,
        role: UserRole.CUSTOMER,
        isVerified: true,
        isActive: true,
        verificationStatus: VerificationStatus.APPROVED,
      },
    });

    const otpSecret = process.env.OTP_HASH_SECRET;
    if (!otpSecret) throw new Error('OTP_HASH_SECRET is required for integration fixtures');
    const digest = createHmac('sha256', otpSecret)
      .update(`${email.toLowerCase()}:FORGOT_PASSWORD:${code}`)
      .digest('hex');

    await prisma.oTP.create({
      data: {
        id: otpId,
        email,
        code: digest,
        type: 'FORGOT_PASSWORD',
        attempts: 0,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('mutates the persisted password, consumes OTP, and authenticates only the new password', async () => {
    const oldHash = (await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { password: true },
    })).password;

    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email, code, newPassword })
      .expect(201);

    const afterReset = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { password: true },
    });
    expect(afterReset.password).not.toBe(oldHash);
    expect(await bcrypt.compare(oldPassword, afterReset.password)).toBe(false);
    expect(await bcrypt.compare(newPassword, afterReset.password)).toBe(true);
    expect(await prisma.oTP.findUnique({ where: { id: otpId } })).toBeNull();

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: oldPassword })
      .expect(401);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: newPassword })
      .expect(201);
    expect((login.headers['set-cookie'] as string[]).some((cookie) => cookie.startsWith('token='))).toBe(true);

    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email, code, newPassword: replayPassword })
      .expect(400);

    const afterReplay = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { password: true },
    });
    expect(afterReplay.password).toBe(afterReset.password);
    expect(await bcrypt.compare(newPassword, afterReplay.password)).toBe(true);
    expect(await bcrypt.compare(replayPassword, afterReplay.password)).toBe(false);

    await request(app.getHttpServer())
      .post('/api/auth/verify-forgot-otp')
      .send({ code, newPassword: replayPassword })
      .expect(400);

    const afterLegacyShape = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { password: true },
    });
    expect(afterLegacyShape.password).toBe(afterReset.password);
  });
});
