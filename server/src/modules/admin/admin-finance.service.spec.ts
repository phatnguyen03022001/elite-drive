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
          totalPrice: 100000.5,
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
      wallet: { findUnique: jest.fn(), updateMany: jest.fn(), upsert: jest.fn() },
      walletTransaction: { createMany: jest.fn() },
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
          totalPrice: 100000,
          car: { ownerId: 'owner-1' },
          trip: { status: 'COMPLETED' },
          payments: [
            { id: 'payment-1', amount: 100000, status: PaymentStatus.COMPLETED },
          ],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      wallet: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        upsert: jest.fn(),
      },
      walletTransaction: { createMany: jest.fn() },
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
    expect(tx.wallet.findUnique).not.toHaveBeenCalled();
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
    expect(tx.wallet.upsert).not.toHaveBeenCalled();
  });

  it('debits only the owner share so the platform fee remains in the platform wallet', async () => {
    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status: 'CONFIRMED',
          totalPrice: 100000,
          car: { ownerId: 'owner-1' },
          trip: { status: 'COMPLETED' },
          payments: [
            { id: 'payment-1', amount: 100000, status: PaymentStatus.COMPLETED },
          ],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      wallet: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'platform-wallet',
          userId: 'platform-user-id',
          balance: 100000,
          currency: 'VND',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn().mockResolvedValue({ id: 'owner-wallet' }),
      },
      walletTransaction: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
      ownerTransaction: { create: jest.fn().mockResolvedValue({ id: 'income-1' }) },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
    ) } as unknown as PrismaService;
    const service = new AdminFinanceService(db, config);

    const result = await service.releasePayment({
      bookingId: 'booking-1',
      platformFeePercent: 20,
    });

    expect(result.ownerReceived).toBe(80000);
    expect(result.platformFee).toBe(20000);
    expect(tx.wallet.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { balance: { decrement: 80000 } },
      }),
    );
    expect(tx.walletTransaction.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ walletId: 'platform-wallet', amount: -80000, type: 'ESCROW_RELEASE' }),
        expect.objectContaining({ walletId: 'owner-wallet', amount: 80000, type: 'RENTAL_INCOME' }),
      ]),
    });
  });

  it('does not debit escrow when a refund was already claimed', async () => {
    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          customerId: 'customer-1',
          status: 'CONFIRMED',
          totalPrice: 100000,
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
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        upsert: jest.fn(),
      },
      walletTransaction: { createMany: jest.fn() },
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
    expect(tx.wallet.findUnique).not.toHaveBeenCalled();
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
    expect(tx.wallet.upsert).not.toHaveBeenCalled();
  });

  it('rejects partial refunds before starting a database transaction', async () => {
    const db = {
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const service = new AdminFinanceService(db, config);

    await expect(
      service.refundPayment({
        bookingId: 'booking-1',
        refundPercent: 50 as 100,
        reason: 'partial refund',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((db as unknown as { $transaction: jest.Mock }).$transaction).not.toHaveBeenCalled();
  });

  it('filters settlement earnings to the requested calendar month', async () => {
    const user = {
      findMany: jest.fn().mockResolvedValue([{ id: 'owner-1' }]),
    };
    const ownerTransaction = {
      groupBy: jest.fn().mockResolvedValue([]),
    };
    const settlement = {
      create: jest.fn().mockResolvedValue({ id: 'settlement-1' }),
    };
    const db = { user, ownerTransaction, settlement } as unknown as PrismaService;
    const service = new AdminFinanceService(db, config);

    await service.runSettlement({ period: '2026-08' });

    expect(ownerTransaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date('2026-08-01T00:00:00.000Z'),
            lt: new Date('2026-09-01T00:00:00.000Z'),
          },
        }),
      }),
    );
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
