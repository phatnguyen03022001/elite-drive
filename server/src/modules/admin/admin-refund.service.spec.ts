import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MomoGatewayService } from '../payment/momo-gateway.service';
import { AdminRefundService } from './admin-refund.service';

describe('AdminRefundService invariants', () => {
  const config = {
    getOrThrow: jest.fn(() => 'platform-user-id'),
  } as unknown as ConfigService;

  it('rejects partial refunds before database/provider access', async () => {
    const db = { booking: { findUnique: jest.fn() } } as unknown as PrismaService;
    const momo = { refund: jest.fn() } as unknown as MomoGatewayService;
    const service = new AdminRefundService(db, momo, config);

    await expect(
      service.refundPayment({
        bookingId: 'booking-1',
        refundPercent: 50 as 100,
        reason: 'partial',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((db as unknown as { booking: { findUnique: jest.Mock } }).booking.findUnique).not.toHaveBeenCalled();
    expect((momo as unknown as { refund: jest.Mock }).refund).not.toHaveBeenCalled();
  });

  it('rejects refund after trip has completed', async () => {
    const db = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          customerId: 'customer-1',
          status: BookingStatus.CONFIRMED,
          totalPrice: 100000,
          trip: { status: 'COMPLETED' },
          payments: [
            {
              id: 'payment-1',
              status: PaymentStatus.COMPLETED,
              paymentMethod: 'MOMO',
              amount: 100000,
              transactionId: 'ORDER-1',
              providerTransactionId: '12345',
              refundOrderId: null,
              refundRequestId: null,
            },
          ],
        }),
      },
    } as unknown as PrismaService;
    const momo = { refund: jest.fn() } as unknown as MomoGatewayService;
    const service = new AdminRefundService(db, momo, config);

    await expect(
      service.refundPayment({
        bookingId: 'booking-1',
        refundPercent: 100,
        reason: 'late refund',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((momo as unknown as { refund: jest.Mock }).refund).not.toHaveBeenCalled();
  });

  it('only credits the customer after MoMo confirms a full refund', async () => {
    const rootBooking = {
      findUnique: jest.fn().mockResolvedValue({
        id: 'booking-1',
        customerId: 'customer-1',
        status: BookingStatus.CONFIRMED,
        totalPrice: 100000,
        trip: { status: 'UPCOMING' },
        payments: [
          {
            id: 'payment-1',
            status: PaymentStatus.COMPLETED,
            paymentMethod: 'MOMO',
            amount: 100000,
            transactionId: 'ORDER-1',
            providerTransactionId: '12345',
            refundOrderId: null,
            refundRequestId: null,
          },
        ],
      }),
    };
    const tx = {
      booking: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ status: BookingStatus.CANCELLED }),
      },
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment-1',
          status: PaymentStatus.COMPLETED,
        }),
      },
      wallet: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'platform-wallet',
          balance: 100000,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn().mockResolvedValue({ id: 'customer-wallet' }),
      },
      walletTransaction: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      trip: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const db = {
      booking: rootBooking,
      payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const momo = {
      refund: jest.fn().mockResolvedValue({
        partnerCode: 'MOMO',
        orderId: 'RF-payment-1',
        requestId: 'RFR-payment-1',
        amount: 100000,
        transId: 777,
        resultCode: 0,
        message: 'Successful.',
        responseTime: Date.now(),
      }),
      queryStatus: jest.fn(),
      queryRefund: jest.fn(),
    } as unknown as MomoGatewayService;
    const service = new AdminRefundService(db, momo, config);

    const result = await service.refundPayment({
      bookingId: 'booking-1',
      refundPercent: 100,
      reason: ' customer request ',
    });

    expect(result.success).toBe(true);
    expect((momo as unknown as { refund: jest.Mock }).refund).toHaveBeenCalledWith({
      orderId: 'RF-payment-1',
      requestId: 'RFR-payment-1',
      amount: 100000,
      transId: 12345,
      description: 'customer request',
    });
    expect(tx.wallet.updateMany).toHaveBeenCalledWith({
      where: { id: 'platform-wallet', balance: { gte: 100000 } },
      data: { balance: { decrement: 100000 } },
    });
    expect(tx.walletTransaction.createMany).toHaveBeenCalledTimes(1);
    expect(tx.trip.deleteMany).toHaveBeenCalledWith({
      where: { bookingId: 'booking-1', status: 'UPCOMING' },
    });
  });
});
