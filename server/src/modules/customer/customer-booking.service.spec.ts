import { ConflictException } from '@nestjs/common';
import { KYCStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomerBookingService } from './customer-booking.service';

describe('CustomerBookingService', () => {
  it('does not insert a booking when the car already overlaps the requested period', async () => {
    const tx = {
      kYC: {
        findUnique: jest.fn().mockResolvedValue({ status: KYCStatus.APPROVED }),
      },
      car: {
        findUnique: jest.fn().mockResolvedValue({ id: 'car-1', pricePerDay: 500000 }),
        update: jest.fn().mockResolvedValue({ id: 'car-1' }),
      },
      booking: {
        findFirst: jest.fn().mockResolvedValue({ id: 'booking-existing' }),
        create: jest.fn(),
      },
      availability: { findFirst: jest.fn() },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new CustomerBookingService(db);

    await expect(
      service.createBooking('customer-1', {
        carId: 'car-1',
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-09-03T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.car.update).toHaveBeenCalledTimes(1);
    expect(tx.booking.create).not.toHaveBeenCalled();
  });
});
