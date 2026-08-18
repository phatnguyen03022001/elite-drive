import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OwnerTripService } from './owner-trip.service';

describe('OwnerTripService invariants', () => {
  it('serializes check-in through the CONFIRMED booking before changing the trip', async () => {
    const tx = {
      trip: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'trip-1',
          bookingId: 'booking-1',
          status: 'UPCOMING',
          booking: { status: BookingStatus.CONFIRMED },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'trip-1',
          status: 'ONGOING',
        }),
      },
      booking: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new OwnerTripService(db);

    await service.checkinTrip('owner-1', 'trip-1', {
      startOdometer: 1000,
      startFuelLevel: 90,
    });

    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-1', status: BookingStatus.CONFIRMED },
      data: { updatedAt: expect.any(Date) },
    });
    expect(tx.trip.updateMany).toHaveBeenCalledWith({
      where: { id: 'trip-1', status: 'UPCOMING' },
      data: expect.objectContaining({ status: 'ONGOING' }),
    });
  });

  it('does not transition the trip when cancellation or another flow consumed the booking lock', async () => {
    const tx = {
      trip: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'trip-1',
          bookingId: 'booking-1',
          status: 'UPCOMING',
          booking: { status: BookingStatus.CONFIRMED },
        }),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      booking: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new OwnerTripService(db);

    await expect(
      service.checkinTrip('owner-1', 'trip-1', {
        startOdometer: 1000,
        startFuelLevel: 90,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.trip.updateMany).not.toHaveBeenCalled();
  });

  it('rejects checkout when the end odometer is lower than check-in', async () => {
    const tx = {
      trip: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'trip-1',
          bookingId: 'booking-1',
          status: 'ONGOING',
          startOdometer: 1200,
          booking: { status: BookingStatus.CONFIRMED },
        }),
        updateMany: jest.fn(),
      },
      booking: { updateMany: jest.fn() },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new OwnerTripService(db);

    await expect(
      service.checkoutTrip('owner-1', 'trip-1', {
        endOdometer: 1199,
        endFuelLevel: 70,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
    expect(tx.trip.updateMany).not.toHaveBeenCalled();
  });

  it('serializes checkout through the booking and rejects a consumed trip claim', async () => {
    const tx = {
      trip: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'trip-1',
          bookingId: 'booking-1',
          status: 'ONGOING',
          startOdometer: 1200,
          booking: { status: BookingStatus.CONFIRMED },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn(),
      },
      booking: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new OwnerTripService(db);

    await expect(
      service.checkoutTrip('owner-1', 'trip-1', {
        endOdometer: 1300,
        endFuelLevel: 70,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.booking.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.trip.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
