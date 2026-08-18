import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomerPromotionService } from './customer-promotion.service';

describe('CustomerPromotionService invariants', () => {
  it('rejects a second promotion on the same booking', async () => {
    const tx = {
      booking: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new CustomerPromotionService(db);

    await expect(
      service.applyPromotion('customer-1', 'booking-1', 'SAVE20'),
    ).rejects.toThrow();
    expect(tx.booking.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ promotionId: null }),
    });
  });

  it('claims limited promotion usage atomically after the booking claim', async () => {
    const now = new Date();
    const tx = {
      booking: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'booking-1',
          customerId: 'customer-1',
          totalPrice: 100000,
          status: BookingStatus.PENDING,
          promotionId: null,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      promotion: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'promo-1',
          code: 'SAVE20',
          isActive: true,
          startDate: new Date(now.getTime() - 60000),
          endDate: new Date(now.getTime() + 60000),
          maxUses: 10,
          usedCount: 9,
          minBookingAmount: null,
          discountType: 'PERCENTAGE',
          discountValue: 20,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new CustomerPromotionService(db);

    const result = await service.applyPromotion('customer-1', 'booking-1', 'save20');

    expect(result.discountAmount).toBe(20000);
    expect(result.finalPrice).toBe(80000);
    expect(tx.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: BookingStatus.PENDING,
          promotionId: null,
          totalPrice: 100000,
        }),
      }),
    );
    expect(tx.promotion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'promo-1',
          usedCount: { lt: 10 },
        }),
        data: { usedCount: { increment: 1 } },
      }),
    );
  });

  it('rolls back by throwing when the promotion usage claim loses a race', async () => {
    const now = new Date();
    const tx = {
      booking: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'booking-1',
          customerId: 'customer-1',
          totalPrice: 100000,
          status: BookingStatus.PENDING,
          promotionId: null,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      promotion: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'promo-1',
          code: 'SAVE20',
          isActive: true,
          startDate: new Date(now.getTime() - 60000),
          endDate: new Date(now.getTime() + 60000),
          maxUses: 1,
          usedCount: 0,
          minBookingAmount: null,
          discountType: 'PERCENTAGE',
          discountValue: 20,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new CustomerPromotionService(db);

    await expect(
      service.applyPromotion('customer-1', 'booking-1', 'SAVE20'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects fractional fixed VND discounts from legacy data', async () => {
    const now = new Date();
    const tx = {
      booking: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'booking-1',
          customerId: 'customer-1',
          totalPrice: 100000,
          status: BookingStatus.PENDING,
          promotionId: null,
        }),
      },
      promotion: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'promo-1',
          code: 'BADFIXED',
          isActive: true,
          startDate: new Date(now.getTime() - 60000),
          endDate: new Date(now.getTime() + 60000),
          maxUses: null,
          usedCount: 0,
          minBookingAmount: null,
          discountType: 'FIXED',
          discountValue: 1234.5,
        }),
      },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new CustomerPromotionService(db);

    await expect(
      service.applyPromotion('customer-1', 'booking-1', 'BADFIXED'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
