import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SecureAdminService } from './secure-admin.service';

describe('SecureAdminService finance invariants', () => {
  const config = {
    getOrThrow: jest.fn(() => 'platform-user-id'),
  } as unknown as ConfigService;

  it('does not mutate wallets when release claim is already consumed', async () => {
    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status: 'CONFIRMED',
          car: { ownerId: 'owner-1' },
          trip: { status: 'COMPLETED' },
          payments: [
            { id: 'payment-1', amount: 100000, status: PaymentStatus.COMPLETED },
          ],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      wallet: {
        updateMany: jest.fn(),
        upsert: jest.fn(),
      },
      walletTransaction: { create: jest.fn() },
      ownerTransaction: { create: jest.fn() },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new SecureAdminService(db, config);

    await expect(
      service.releasePayment({ bookingId: 'booking-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
    expect(tx.wallet.upsert).not.toHaveBeenCalled();
  });

  it('does not debit escrow when a refund was already claimed', async () => {
    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          customerId: 'customer-1',
          payments: [
            { id: 'payment-1', amount: 100000, status: PaymentStatus.COMPLETED },
          ],
        }),
        update: jest.fn(),
      },
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      wallet: {
        updateMany: jest.fn(),
        upsert: jest.fn(),
      },
      walletTransaction: { create: jest.fn() },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new SecureAdminService(db, config);

    await expect(
      service.refundPayment({
        bookingId: 'booking-1',
        refundPercent: 100,
        reason: 'duplicate request',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
    expect(tx.wallet.upsert).not.toHaveBeenCalled();
  });

  it('never exposes password from payment listing', async () => {
    const payment = {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'payment-1',
          user: {
            id: 'user-1',
            email: 'user@example.com',
            password: 'hashed-secret',
          },
          booking: null,
        },
      ]),
    };
    const db = { payment } as unknown as PrismaService;
    const service = new SecureAdminService(db, config);

    const result = await service.getPayments({ page: 1, limit: 20 });

    expect(result[0].user.password).toBeUndefined();
    expect(result[0].user.email).toBe('user@example.com');
  });
});
