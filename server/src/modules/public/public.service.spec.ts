import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PublicService } from './public.service';

describe('PublicService marketplace validation', () => {
  const service = new PublicService({} as PrismaService);

  it('rejects a partial rental date range', async () => {
    await expect(
      service.getCars({
        startDate: new Date('2026-08-20T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a reversed rental date range', async () => {
    await expect(
      service.getCars({
        startDate: new Date('2026-08-22T00:00:00.000Z'),
        endDate: new Date('2026-08-20T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an inverted price range', async () => {
    await expect(
      service.getCars({ minPrice: 2_000_000, maxPrice: 1_000_000 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
