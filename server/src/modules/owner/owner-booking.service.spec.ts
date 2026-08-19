import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OwnerBookingService } from './owner-booking.service';

describe('OwnerBookingService invariants', () => {
  it('uses a conditional PENDING claim before approving a booking', async () => {
    const booking = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.PENDING,
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.APPROVED,
      }),
    };
    const service = new OwnerBookingService(
      { booking } as unknown as PrismaService,
    );

    await service.approveBooking('owner-1', 'booking-1');

    expect(booking.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'booking-1',
        status: BookingStatus.PENDING,
        car: { ownerId: 'owner-1' },
      },
      data: { status: BookingStatus.APPROVED },
    });
  });

  it('rejects a concurrent decision when the atomic claim was already consumed', async () => {
    const booking = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.PENDING,
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUniqueOrThrow: jest.fn(),
    };
    const service = new OwnerBookingService(
      { booking } as unknown as PrismaService,
    );

    await expect(
      service.rejectBooking('owner-1', 'booking-1', { reason: 'Unavailable' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(booking.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('does not mutate payment or wallet state when an owner rejects a booking', async () => {
    const booking = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.PENDING,
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.REJECTED,
        notes: 'Customer requested child seat',
      }),
    };
    const db = {
      booking,
      payment: { update: jest.fn(), updateMany: jest.fn() },
      wallet: { update: jest.fn(), updateMany: jest.fn(), upsert: jest.fn() },
      walletTransaction: { create: jest.fn(), createMany: jest.fn() },
    } as unknown as PrismaService;
    const service = new OwnerBookingService(db);

    const result = await service.rejectBooking('owner-1', 'booking-1', {
      reason: 'Vehicle unavailable',
    });

    expect(result.notes).toBe('Customer requested child seat');
    expect(result.decisionReason).toBe('Vehicle unavailable');
    expect((db as unknown as { payment: { update: jest.Mock } }).payment.update).not.toHaveBeenCalled();
    expect((db as unknown as { wallet: { upsert: jest.Mock } }).wallet.upsert).not.toHaveBeenCalled();
    expect((db as unknown as { walletTransaction: { create: jest.Mock } }).walletTransaction.create).not.toHaveBeenCalled();
  });
});
