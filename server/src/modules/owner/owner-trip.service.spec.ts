import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OwnerTripService } from './owner-trip.service';

describe('OwnerTripService invariants', () => {
  it('checks in only with an atomic UPCOMING + CONFIRMED claim', async () => {
    const trip = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'trip-1',
        status: 'UPCOMING',
        booking: { status: BookingStatus.CONFIRMED },
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'trip-1',
        status: 'ONGOING',
      }),
    };
    const service = new OwnerTripService({ trip } as unknown as PrismaService);

    await service.checkinTrip('owner-1', 'trip-1', {
      startOdometer: 1000,
      startFuelLevel: 90,
    });

    expect(trip.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'trip-1',
        status: 'UPCOMING',
        car: { ownerId: 'owner-1' },
        booking: { status: BookingStatus.CONFIRMED },
      },
      data: expect.objectContaining({ status: 'ONGOING' }),
    });
  });

  it('rejects check-in when another transition consumed the claim', async () => {
    const trip = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'trip-1',
        status: 'UPCOMING',
        booking: { status: BookingStatus.CONFIRMED },
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUniqueOrThrow: jest.fn(),
    };
    const service = new OwnerTripService({ trip } as unknown as PrismaService);

    await expect(
      service.checkinTrip('owner-1', 'trip-1', {
        startOdometer: 1000,
        startFuelLevel: 90,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(trip.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('rejects checkout when the end odometer is lower than check-in', async () => {
    const trip = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'trip-1',
        status: 'ONGOING',
        startOdometer: 1200,
        booking: { status: BookingStatus.CONFIRMED },
      }),
      updateMany: jest.fn(),
    };
    const service = new OwnerTripService({ trip } as unknown as PrismaService);

    await expect(
      service.checkoutTrip('owner-1', 'trip-1', {
        endOdometer: 1199,
        endFuelLevel: 70,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(trip.updateMany).not.toHaveBeenCalled();
  });

  it('requires the booking to remain CONFIRMED during checkout', async () => {
    const trip = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'trip-1',
        status: 'ONGOING',
        startOdometer: 1200,
        booking: { status: BookingStatus.CONFIRMED },
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUniqueOrThrow: jest.fn(),
    };
    const service = new OwnerTripService({ trip } as unknown as PrismaService);

    await expect(
      service.checkoutTrip('owner-1', 'trip-1', {
        endOdometer: 1300,
        endFuelLevel: 70,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(trip.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
