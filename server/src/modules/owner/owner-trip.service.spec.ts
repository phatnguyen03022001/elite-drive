import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OwnerTripService } from './owner-trip.service';

describe('OwnerTripService invariants', () => {
  const signedBooking = {
    status: BookingStatus.CONFIRMED,
    startDate: new Date('2020-08-20T00:00:00.000Z'),
    contract: { customerSignedAt: new Date('2020-08-19T00:00:00.000Z') },
  };

  it('requires a signed contract before changing an upcoming trip', async () => {
    const tx = {
      trip: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'trip-1', bookingId: 'booking-1', status: 'UPCOMING',
          booking: { status: BookingStatus.CONFIRMED, startDate: new Date('2020-08-20T00:00:00.000Z'), contract: null },
        }),
        updateMany: jest.fn(),
      },
      booking: { updateMany: jest.fn() },
    };
    const db = { $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    const service = new OwnerTripService(db);

    await expect(service.checkinTrip('owner-1', 'trip-1', { startOdometer: 1000, startFuelLevel: 90 }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
    expect(tx.trip.updateMany).not.toHaveBeenCalled();
  });

  it('rejects vehicle handover before the booking start time', async () => {
    const tx = {
      trip: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'trip-1', bookingId: 'booking-1', status: 'UPCOMING',
          booking: {
            status: BookingStatus.CONFIRMED,
            startDate: new Date('2999-01-01T00:00:00.000Z'),
            contract: { customerSignedAt: new Date('2020-01-01T00:00:00.000Z') },
          },
        }),
        updateMany: jest.fn(),
      },
      booking: { updateMany: jest.fn() },
    };
    const db = { $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    const service = new OwnerTripService(db);

    await expect(service.checkinTrip('owner-1', 'trip-1', { startOdometer: 1000, startFuelLevel: 90 }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
    expect(tx.trip.updateMany).not.toHaveBeenCalled();
  });

  it('serializes check-in through the CONFIRMED booking before changing the trip', async () => {
    const tx = {
      trip: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'trip-1', bookingId: 'booking-1', status: 'UPCOMING', booking: signedBooking,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'trip-1', status: 'ONGOING' }),
      },
      booking: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const db = { $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    const service = new OwnerTripService(db);

    await service.checkinTrip('owner-1', 'trip-1', { startOdometer: 1000, startFuelLevel: 90 });

    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-1', status: BookingStatus.CONFIRMED },
      data: { updatedAt: expect.any(Date) },
    });
    expect(tx.trip.updateMany).toHaveBeenCalledWith({
      where: { id: 'trip-1', status: 'UPCOMING' },
      data: expect.objectContaining({ status: 'ONGOING' }),
    });
  });

  it('rejects checkout when the end odometer is lower than check-in', async () => {
    const tx = {
      trip: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'trip-1', bookingId: 'booking-1', status: 'ONGOING', startOdometer: 1200,
          booking: { status: BookingStatus.CONFIRMED },
        }),
        updateMany: jest.fn(),
      },
      booking: { updateMany: jest.fn() },
    };
    const db = { $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    const service = new OwnerTripService(db);

    await expect(service.checkoutTrip('owner-1', 'trip-1', { endOdometer: 1199, endFuelLevel: 70 }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
    expect(tx.trip.updateMany).not.toHaveBeenCalled();
  });

  it('marks both trip and booking complete atomically after vehicle return', async () => {
    const tx = {
      trip: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'trip-1', bookingId: 'booking-1', status: 'ONGOING', startOdometer: 1200,
          booking: { status: BookingStatus.CONFIRMED },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'trip-1', status: 'COMPLETED' }),
      },
      booking: {
        updateMany: jest.fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 1 }),
      },
    };
    const db = { $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    const service = new OwnerTripService(db);

    await service.checkoutTrip('owner-1', 'trip-1', { endOdometer: 1300, endFuelLevel: 70 });

    expect(tx.trip.updateMany).toHaveBeenCalledWith({
      where: { id: 'trip-1', status: 'ONGOING' },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    });
    expect(tx.booking.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'booking-1', status: BookingStatus.CONFIRMED },
      data: { status: BookingStatus.COMPLETED },
    });
  });
});
