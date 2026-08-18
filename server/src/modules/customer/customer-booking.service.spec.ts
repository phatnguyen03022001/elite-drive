import { ConflictException, NotFoundException } from '@nestjs/common';
import { KYCStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomerBookingService } from './customer-booking.service';

const approvedCar = {
  id: 'car-1',
  pricePerDay: 500000,
  location: {
    name: 'District 1 Hub',
    address: '123 Nguyen Hue',
    city: 'Ho Chi Minh City',
  },
};

describe('CustomerBookingService', () => {
  it('does not insert a booking when the car already overlaps the requested period', async () => {
    const tx = {
      kYC: {
        findUnique: jest.fn().mockResolvedValue({ status: KYCStatus.APPROVED }),
      },
      car: {
        findFirst: jest.fn().mockResolvedValue(approvedCar),
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

  it('rejects cars that are not approved, verified and available', async () => {
    const tx = {
      kYC: {
        findUnique: jest.fn().mockResolvedValue({ status: KYCStatus.APPROVED }),
      },
      car: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      booking: { findFirst: jest.fn(), create: jest.fn() },
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
        carId: 'car-hidden',
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-09-03T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(tx.car.update).not.toHaveBeenCalled();
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it('derives booking handover location from the approved car record', async () => {
    const tx = {
      kYC: {
        findUnique: jest.fn().mockResolvedValue({ status: KYCStatus.APPROVED }),
      },
      car: {
        findFirst: jest.fn().mockResolvedValue(approvedCar),
        update: jest.fn().mockResolvedValue({ id: 'car-1' }),
      },
      booking: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => data),
      },
      availability: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new CustomerBookingService(db);

    await service.createBooking('customer-1', {
      carId: 'car-1',
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-09-03T00:00:00.000Z',
      pickupLocation: 'attacker-controlled pickup',
      dropoffLocation: 'attacker-controlled dropoff',
    });

    const data = tx.booking.create.mock.calls[0][0].data;
    expect(data.pickupLocation).toBe(
      'District 1 Hub, 123 Nguyen Hue, Ho Chi Minh City',
    );
    expect(data.dropoffLocation).toBe(data.pickupLocation);
  });
});
