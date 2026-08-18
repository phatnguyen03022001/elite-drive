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
});
