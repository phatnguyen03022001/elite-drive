import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminPromotionService } from './admin-promotion.service';

describe('AdminPromotionService invariants', () => {
  it('rejects a percentage promotion above 100 percent', async () => {
    const service = new AdminPromotionService({} as PrismaService);
    await expect(
      service.create({
        code: 'TOO-MUCH',
        discountType: 'PERCENTAGE',
        discountValue: 101,
        startDate: '2026-08-01T00:00:00.000Z',
        endDate: '2026-09-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects fractional fixed VND discounts', async () => {
    const service = new AdminPromotionService({} as PrismaService);
    await expect(
      service.create({
        code: 'BAD-FIXED',
        discountType: 'FIXED',
        discountValue: 1000.5,
        startDate: '2026-08-01T00:00:00.000Z',
        endDate: '2026-09-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects inverted promotion date ranges', async () => {
    const service = new AdminPromotionService({} as PrismaService);
    await expect(
      service.create({
        code: 'BAD-DATE',
        discountType: 'FIXED',
        discountValue: 1000,
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-08-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes the promotion code before persistence', async () => {
    const promotion = {
      create: jest.fn().mockResolvedValue({ id: 'promo-1', code: 'SAVE-20' }),
    };
    const service = new AdminPromotionService(
      { promotion } as unknown as PrismaService,
    );

    await service.create({
      code: ' save-20 ',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      maxUses: 100,
      minBookingAmount: 100000,
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: '2026-09-01T00:00:00.000Z',
    });

    expect(promotion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'SAVE-20' }),
      }),
    );
  });
});
