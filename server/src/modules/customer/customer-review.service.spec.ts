import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomerReviewService } from './customer-review.service';

describe('CustomerReviewService invariants', () => {
  it('rejects a review for another customer booking', async () => {
    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          customerId: 'other-customer',
          carId: 'car-1',
          status: BookingStatus.COMPLETED,
        }),
      },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new CustomerReviewService(db);

    await expect(
      service.createReview('customer-1', {
        bookingId: 'booking-1',
        carId: 'car-1',
        rating: 5,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires a completed booking', async () => {
    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          customerId: 'customer-1',
          carId: 'car-1',
          status: BookingStatus.CONFIRMED,
        }),
      },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new CustomerReviewService(db);

    await expect(
      service.createReview('customer-1', {
        bookingId: 'booking-1',
        carId: 'car-1',
        rating: 5,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('serializes duplicate review creation on the booking', async () => {
    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          customerId: 'customer-1',
          carId: 'car-1',
          status: BookingStatus.COMPLETED,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      review: { findFirst: jest.fn(), create: jest.fn() },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new CustomerReviewService(db);

    await expect(
      service.createReview('customer-1', {
        bookingId: 'booking-1',
        carId: 'car-1',
        rating: 5,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.review.create).not.toHaveBeenCalled();
  });

  it('creates exactly one review after booking lock and duplicate check', async () => {
    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          customerId: 'customer-1',
          carId: 'car-1',
          status: BookingStatus.COMPLETED,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      review: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'review-1' }),
      },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new CustomerReviewService(db);

    await service.createReview('customer-1', {
      bookingId: 'booking-1',
      carId: 'car-1',
      rating: 5,
      title: ' Great trip ',
    });

    expect(tx.review.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'customer-1',
        bookingId: 'booking-1',
        carId: 'car-1',
        rating: 5,
        title: 'Great trip',
      }),
    });
  });
});
