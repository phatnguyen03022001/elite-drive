import { BadRequestException } from '@nestjs/common';
import { BookingStatus, CarStatus, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { OwnerService } from './owner.service';

describe('OwnerService listing invariants', () => {
  it('returns an edited listing to pending review', async () => {
    const prisma = {
      car: {
        findUnique: jest.fn().mockResolvedValue({ ownerId: 'owner-1' }),
        update: jest.fn().mockResolvedValue({ id: 'car-1' }),
      },
    } as unknown as PrismaService;
    const upload = { uploadFile: jest.fn() } as unknown as UploadService;
    const service = new OwnerService(prisma, upload);

    await service.updateCar('owner-1', 'car-1', { name: 'Updated vehicle' });

    expect((prisma as any).car.update).toHaveBeenCalledWith({
      where: { id: 'car-1' },
      data: expect.objectContaining({
        name: 'Updated vehicle',
        status: CarStatus.PENDING,
        verificationStatus: VerificationStatus.PENDING,
        rejectionReason: null,
      }),
    });
  });

  it('locks the car in the delete transaction before checking booking history', async () => {
    const tx = {
      car: {
        findFirst: jest.fn().mockResolvedValue({ id: 'car-1' }),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'car-1' }),
        delete: jest.fn(),
      },
      booking: {
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const upload = { uploadFile: jest.fn() } as unknown as UploadService;
    const service = new OwnerService(prisma, upload);

    await expect(service.deleteCar('owner-1', 'car-1')).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.car.update).toHaveBeenCalledWith({
      where: { id: 'car-1' },
      data: { updatedAt: expect.any(Date) },
      select: { id: true },
    });
    expect(tx.booking.count).toHaveBeenCalledWith({ where: { carId: 'car-1' } });
    expect(tx.car.update.mock.invocationCallOrder[0]).toBeLessThan(tx.booking.count.mock.invocationCallOrder[0]);
    expect(tx.car.delete).not.toHaveBeenCalled();
  });

  it('normalizes a block to a UTC day and rejects overlap with an active booking', async () => {
    const tx = {
      car: {
        findFirst: jest.fn().mockResolvedValue({ id: 'car-1' }),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'car-1' }),
      },
      booking: {
        findFirst: jest.fn().mockResolvedValue({ id: 'booking-1' }),
      },
      availability: {
        upsert: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const upload = { uploadFile: jest.fn() } as unknown as UploadService;
    const service = new OwnerService(prisma, upload);

    await expect(
      service.blockAvailability('owner-1', 'car-1', {
        date: '2026-08-20T15:30:00.000Z',
        isBlocked: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.car.update).toHaveBeenCalledTimes(1);
    expect(tx.booking.findFirst).toHaveBeenCalledWith({
      where: {
        carId: 'car-1',
        status: {
          in: [
            BookingStatus.PENDING,
            BookingStatus.APPROVED,
            BookingStatus.CONFIRMED,
          ],
        },
        startDate: { lt: new Date('2026-08-21T00:00:00.000Z') },
        endDate: { gt: new Date('2026-08-20T00:00:00.000Z') },
      },
      select: { id: true },
    });
    expect(tx.availability.upsert).not.toHaveBeenCalled();
  });
});