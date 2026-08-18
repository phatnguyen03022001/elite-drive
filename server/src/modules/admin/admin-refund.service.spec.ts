import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminRefundService } from './admin-refund.service';

describe('AdminRefundService invariants', () => {
  const config = {
    getOrThrow: jest.fn(() => 'platform-user-id'),
  } as unknown as ConfigService;

  it('rejects MoMo refund before changing local payment state', async () => {
    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.CONFIRMED,
          totalPrice: 100000,
          trip: { status: 'UPCOMING' },
          payments: [
            {
              id: 'payment-1',
              status: PaymentStatus.COMPLETED,
              paymentMethod: 'MOMO',
              amount: 100000,
            },
          ],
        }),
      },
      payment: { updateMany: jest.fn() },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new AdminRefundService(db, config);

    await expect(
      service.refundPayment({
        bookingId: 'booking-1',
        refundPercent: 100,
        reason: 'customer request',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
  });

  it('rejects refund after trip has completed', async () => {
    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.CONFIRMED,
          trip: { status: 'COMPLETED' },
          payments: [],
        }),
      },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new AdminRefundService(db, config);

    await expect(
      service.refundPayment({
        bookingId: 'booking-1',
        refundPercent: 100,
        reason: 'late refund',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
