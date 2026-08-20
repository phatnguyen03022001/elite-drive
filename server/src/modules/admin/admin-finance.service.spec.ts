import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminFinanceService } from './admin-finance.service';

describe('AdminFinanceService invariants', () => {
  const config = { getOrThrow: jest.fn(() => 'platform-user-id') } as unknown as ConfigService;

  it('rejects fractional payment amounts before claiming escrow release', async () => {
    const tx = {
      booking: { findUnique: jest.fn().mockResolvedValue({ id: 'booking-1', status: BookingStatus.COMPLETED, totalPrice: 100000.5, car: { ownerId: 'owner-1' }, trip: { status: 'COMPLETED' }, payments: [{ id: 'payment-1', amount: 100000.5, status: PaymentStatus.COMPLETED, releasedAt: null }] }) },
      payment: { updateMany: jest.fn() },
      wallet: { findUnique: jest.fn(), updateMany: jest.fn(), upsert: jest.fn() },
      walletTransaction: { createMany: jest.fn() },
      ownerTransaction: { create: jest.fn() },
    };
    const db = { $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    const service = new AdminFinanceService(db, config);
    await expect(service.releasePayment({ bookingId: 'booking-1' })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
  });

  it('uses Payment.releasedAt as the atomic release claim', async () => {
    const tx = {
      booking: { findUnique: jest.fn().mockResolvedValue({ id: 'booking-1', status: BookingStatus.COMPLETED, totalPrice: 100000, car: { ownerId: 'owner-1' }, trip: { status: 'COMPLETED' }, payments: [{ id: 'payment-1', amount: 100000, status: PaymentStatus.COMPLETED, releasedAt: null }] }) },
      payment: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      wallet: { findUnique: jest.fn(), updateMany: jest.fn(), upsert: jest.fn() },
      walletTransaction: { createMany: jest.fn() },
      ownerTransaction: { create: jest.fn() },
    };
    const db = { $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    const service = new AdminFinanceService(db, config);
    await expect(service.releasePayment({ bookingId: 'booking-1' })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'payment-1',
        status: PaymentStatus.COMPLETED,
        OR: [
          { releasedAt: null },
          { releasedAt: { isSet: false } },
        ],
      },
      data: { releasedAt: expect.any(Date) },
    });
    expect(tx.wallet.findUnique).not.toHaveBeenCalled();
  });

  it('debits only the owner share and keeps platform fee in escrow wallet', async () => {
    const tx = {
      booking: { findUnique: jest.fn().mockResolvedValue({ id: 'booking-1', status: BookingStatus.COMPLETED, totalPrice: 100000, car: { ownerId: 'owner-1' }, trip: { status: 'COMPLETED' }, payments: [{ id: 'payment-1', amount: 100000, status: PaymentStatus.COMPLETED, releasedAt: null }] }) },
      payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      wallet: {
        findUnique: jest.fn().mockResolvedValue({ id: 'platform-wallet', userId: 'platform-user-id', balance: 100000, currency: 'VND' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn().mockResolvedValue({ id: 'owner-wallet' }),
      },
      walletTransaction: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
      ownerTransaction: { create: jest.fn().mockResolvedValue({ id: 'income-1' }) },
    };
    const db = { $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    const service = new AdminFinanceService(db, config);
    const result = await service.releasePayment({ bookingId: 'booking-1', platformFeePercent: 20 });
    expect(result.ownerReceived).toBe(80000);
    expect(result.platformFee).toBe(20000);
    expect(tx.wallet.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { balance: { decrement: 80000 } } }));
  });

  it('lists completed trips whose release marker is null or absent', async () => {
    const trip = { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) };
    const service = new AdminFinanceService({ trip } as unknown as PrismaService, config);
    await service.getPendingReleaseTrips({ page: 1, limit: 20 });
    expect(trip.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        status: 'COMPLETED',
        booking: {
          status: BookingStatus.COMPLETED,
          payments: {
            some: {
              status: PaymentStatus.COMPLETED,
              OR: [
                { releasedAt: null },
                { releasedAt: { isSet: false } },
              ],
            },
          },
        },
      },
    }));
  });

  it('selects only non-sensitive user fields in payment listing', async () => {
    const payment = { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) };
    const service = new AdminFinanceService({ payment } as unknown as PrismaService, config);
    await service.getPayments({ page: 1, limit: 20 });
    const select = payment.findMany.mock.calls[0][0].select;
    expect(select.user.select).toEqual({ id: true, email: true, firstName: true, lastName: true });
    expect(select.user.select.password).toBeUndefined();
    expect(select.releasedAt).toBe(true);
  });

  it('treats a date-only payment end filter as the full UTC day', async () => {
    const payment = { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) };
    const service = new AdminFinanceService({ payment } as unknown as PrismaService, config);

    await service.getPayments({
      page: 1,
      limit: 20,
      from: '2026-08-19',
      to: '2026-08-20',
    });

    const where = payment.findMany.mock.calls[0][0].where;
    expect(where.createdAt).toEqual({
      gte: new Date('2026-08-19T00:00:00.000Z'),
      lt: new Date('2026-08-21T00:00:00.000Z'),
      lte: undefined,
    });
    expect(payment.count).toHaveBeenCalledWith({ where });
  });
});