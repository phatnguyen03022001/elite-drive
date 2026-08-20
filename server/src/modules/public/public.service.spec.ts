import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PublicService } from './public.service';

describe('PublicService marketplace validation', () => {
  it('rejects a partial rental date range', async () => {
    const service = new PublicService({} as PrismaService);
    await expect(
      service.getCars({
        startDate: new Date('2026-08-20T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a reversed rental date range', async () => {
    const service = new PublicService({} as PrismaService);
    await expect(
      service.getCars({
        startDate: new Date('2026-08-22T00:00:00.000Z'),
        endDate: new Date('2026-08-20T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an inverted price range', async () => {
    const service = new PublicService({} as PrismaService);
    await expect(
      service.getCars({ minPrice: 2_000_000, maxPrice: 1_000_000 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not expose reviews for a vehicle that is not currently published', async () => {
    const review = {
      findMany: jest.fn(),
      count: jest.fn(),
    };
    const car = {
      findFirst: jest.fn().mockResolvedValue(null),
    };
    const service = new PublicService({ car, review } as unknown as PrismaService);

    await expect(
      service.getCarReviews('car-1', { page: 1, limit: 10 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(review.findMany).not.toHaveBeenCalled();
    expect(review.count).not.toHaveBeenCalled();
  });
});
