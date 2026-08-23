import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OwnerBookingService } from './owner-booking.service';

type BookingMock = {
  findFirst: jest.Mock;
  updateMany: jest.Mock;
  findUniqueOrThrow: jest.Mock;
};

function createPrismaMock(booking: BookingMock): PrismaService {
  const tx = {
    booking,
    promotion: { updateMany: jest.fn() },
  };
  const db = {
    ...tx,
    $transaction: jest.fn(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    ),
  };
  return db as unknown as PrismaService;
}

describe('OwnerBookingService invariants', () => {
  it('uses a conditional PENDING claim before approving a booking', async () => {
    const booking = {
      findFirst: jest.fn().mockResolvedValue({ id: 'booking-1', status: BookingStatus.PENDING }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'booking-1', status: BookingStatus.APPROVED }),
    };
    const service = new OwnerBookingService(createPrismaMock(booking));
    await service.approveBooking('owner-1', 'booking-1');
    expect(booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-1', status: BookingStatus.PENDING, car: { ownerId: 'owner-1' } },
      data: { status: BookingStatus.APPROVED },
    });
  });

  it('rejects a concurrent decision when the atomic claim was already consumed', async () => {
    const booking = {
      findFirst: jest.fn().mockResolvedValue({ id: 'booking-1', status: BookingStatus.PENDING }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUniqueOrThrow: jest.fn(),
    };
    const service = new OwnerBookingService(createPrismaMock(booking));
    await expect(service.rejectBooking('owner-1', 'booking-1', { reason: 'Unavailable' })).rejects.toBeInstanceOf(BadRequestException);
    expect(booking.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('persists the rejection reason without overwriting customer notes', async () => {
    const booking = {
      findFirst: jest.fn().mockResolvedValue({ id: 'booking-1', status: BookingStatus.PENDING }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.REJECTED,
        notes: 'Customer requested child seat',
        decisionReason: 'Vehicle unavailable',
      }),
    };
    const service = new OwnerBookingService(createPrismaMock(booking));
    const result = await service.rejectBooking('owner-1', 'booking-1', { reason: '  Vehicle unavailable  ' });

    expect(booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-1', status: BookingStatus.PENDING, car: { ownerId: 'owner-1' } },
      data: { status: BookingStatus.REJECTED, decisionReason: 'Vehicle unavailable' },
    });
    expect(result.notes).toBe('Customer requested child seat');
    expect(result.decisionReason).toBe('Vehicle unavailable');
  });
});
