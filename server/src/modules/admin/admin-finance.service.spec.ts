import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminFinanceService } from './admin-finance.service';

describe('AdminFinanceService invariants', () => {
  const config = {
    getOrThrow: jest.fn(() => 'platform-user-id'),
  } as unknown as ConfigService;

  it('rejects fractional payment amounts before releasing escrow', async () => {
    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status: 'CONFIRMED',
          car: { ownerId: 'owner-1' },
          trip: { status: 'COMPLETED' },
          payments: [
            {
              id: 'payment-1',
              amount: 100000.5,
              status: PaymentStatus.COMPLETED,
            },
          ],
        }),
        updateMany: jest.fn(),
      },
      wallet: { updateMany: jest.fn(), upsert: jest.fn() },
      walletTransaction: { create: jest.fn() },
      ownerTransaction: { create: jest.fn() },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new AdminFinanceService(db, config);

    await expect(
      service.releasePayment({ bookingId: 'booking-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
  });

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
    const service = new AdminFinanceService(db, config);

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
    const service = new AdminFinanceService(db, config);

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

  it('selects only non-sensitive user fields in payment listing', async () => {
    const payment = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    const db = { payment } as unknown as PrismaService;
    const service = new AdminFinanceService(db, config);

    await service.getPayments({ page: 1, limit: 20 });

    const select = payment.findMany.mock.calls[0][0].select;
    expect(select.user.select).toEqual({
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    });
    expect(select.user.select.password).toBeUndefined();
  });
});
