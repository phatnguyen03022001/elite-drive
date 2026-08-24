import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomerCancellationService } from './customer-cancellation.service';

describe('CustomerCancellationService invariants', () => {
  const config = {
    getOrThrow: jest.fn(() => 'platform-user-id'),
  } as unknown as ConfigService;

  it('rejects cancellation once the trip is ongoing', async () => {
    const tx = {
      booking: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.CONFIRMED,
          trip: { status: 'ONGOING' },
          payments: [],
        }),
        updateMany: jest.fn(),
      },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new CustomerCancellationService(db, config);

    await expect(
      service.cancelBooking('customer-1', 'booking-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
  });

  it('rejects local refund for a completed MoMo payment', async () => {
    const tx = {
      booking: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.CONFIRMED,
          trip: { status: 'UPCOMING' },
          payments: [
            {
              id: 'payment-1',
              status: PaymentStatus.COMPLETED,
              paymentMethod: 'MOMO',
              amount: 100000,
              releasedAt: null,
            },
          ],
        }),
        updateMany: jest.fn(),
      },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new CustomerCancellationService(db, config);

    await expect(
      service.cancelBooking('customer-1', 'booking-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
  });

  it('rejects refund when escrow has already been released', async () => {
    const tx = {
      booking: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.CONFIRMED,
          totalPrice: 100000,
          trip: { status: 'UPCOMING' },
          payments: [
            {
              id: 'payment-1',
              status: PaymentStatus.COMPLETED,
              paymentMethod: 'MOCK_QR',
              amount: 100000,
              releasedAt: new Date(),
            },
          ],
        }),
        updateMany: jest.fn(),
      },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new CustomerCancellationService(db, config);

    await expect(
      service.cancelBooking('customer-1', 'booking-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
  });

  it('claims cancellation only while trip is absent or upcoming', async () => {
    const tx = {
      booking: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.APPROVED,
          trip: null,
          payments: [],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.CANCELLED,
        }),
      },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new CustomerCancellationService(db, config);

    await service.cancelBooking('customer-1', 'booking-1');

    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'booking-1',
        customerId: 'customer-1',
        OR: [
          { trip: null },
          { trip: { is: { status: 'UPCOMING' } } },
        ],
      }),
      data: { status: BookingStatus.CANCELLED },
    });
  });

  it('keeps invalid booking statuses on the booking claim failure path', async () => {
    const tx = {
      booking: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.CANCELLED,
          trip: null,
          payments: [],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new CustomerCancellationService(db, config);

    await expect(service.cancelBooking('customer-1', 'booking-1')).rejects.toThrow(
      'Booking đã được xử lý, trip đã bắt đầu hoặc không thể hủy',
    );
    expect(tx.booking.updateMany).toHaveBeenCalledTimes(1);
  });

  it('releases the promotion slot once an unpaid cancellation is claimed', async () => {
    const tx = {
      booking: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.PENDING,
          promotionId: 'promotion-1',
          trip: null,
          payments: [],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.CANCELLED,
        }),
      },
      promotion: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new CustomerCancellationService(db, config);

    await service.cancelBooking('customer-1', 'booking-1');

    expect(tx.promotion.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.promotion.updateMany).toHaveBeenCalledWith({
      where: { id: 'promotion-1', usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  });

  it('refunds unreleased escrow when optional refund timestamps are null or absent', async () => {
    const tx = {
      booking: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'booking-1',
          customerId: 'customer-1',
          status: BookingStatus.CONFIRMED,
          promotionId: 'promotion-1',
          totalPrice: 100000,
          trip: { status: 'UPCOMING' },
          payments: [
            {
              id: 'payment-1',
              status: PaymentStatus.COMPLETED,
              paymentMethod: 'MOCK_QR',
              amount: 100000,
              releasedAt: null,
            },
          ],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.CANCELLED,
        }),
      },
      promotion: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      wallet: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'platform-wallet',
          balance: 100000,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn().mockResolvedValue({ id: 'customer-wallet' }),
      },
      walletTransaction: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      trip: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new CustomerCancellationService(db, config);

    await service.cancelBooking('customer-1', 'booking-1');

    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'payment-1',
        status: PaymentStatus.COMPLETED,
        AND: [
          {
            OR: [
              { refundedAt: null },
              { refundedAt: { isSet: false } },
            ],
          },
          {
            OR: [
              { releasedAt: null },
              { releasedAt: { isSet: false } },
            ],
          },
        ],
      },
      data: expect.objectContaining({
        status: PaymentStatus.REFUNDED,
      }),
    });
    expect(tx.promotion.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.promotion.updateMany).toHaveBeenCalledWith({
      where: { id: 'promotion-1', usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
    expect(tx.trip.deleteMany).toHaveBeenCalledWith({
      where: { bookingId: 'booking-1', status: 'UPCOMING' },
    });
  });
});
