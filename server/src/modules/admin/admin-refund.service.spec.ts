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
              releasedAt: null,
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

  it('rejects a payment that has already been released from escrow', async () => {
    const db = {
      booking: {
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
              releasedAt: new Date(),
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
        reason: 'released payment',
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
            releasedAt: null,
          },
        ],
      }),
    };
    const tx = createRefundTx();
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
    expect(tx.promotion.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.promotion.updateMany).toHaveBeenCalledWith({
      where: { id: 'promotion-1', usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
    expect(tx.walletTransaction.createMany).toHaveBeenCalledTimes(1);
    expect(tx.trip.deleteMany).toHaveBeenCalledWith({
      where: { bookingId: 'booking-1', status: 'UPCOMING' },
    });
  });

  it('reclaims a restored booking before resuming an existing MoMo refund intent', async () => {
    const tx = createRefundTx();
    const db = {
      booking: {
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
              refundOrderId: 'RF-payment-1',
              refundRequestId: 'RFR-payment-1',
              releasedAt: null,
            },
          ],
        }),
      },
      payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const momo = {
      queryRefund: jest.fn().mockResolvedValue({
        partnerCode: 'MOMO',
        orderId: 'RF-payment-1',
        requestId: 'RFR-payment-1',
        resultCode: 0,
        message: 'Successful.',
        responseTime: Date.now(),
        refundTrans: [
          {
            orderId: 'RF-payment-1',
            amount: 100000,
            resultCode: 0,
            transId: 777,
          },
        ],
      }),
      refund: jest.fn(),
      queryStatus: jest.fn(),
    } as unknown as MomoGatewayService;
    const service = new AdminRefundService(db, momo, config);

    await service.refundPayment({
      bookingId: 'booking-1',
      refundPercent: 100,
      reason: 'retry after provider failure',
    });

    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'booking-1',
        status: BookingStatus.CONFIRMED,
        OR: [{ trip: null }, { trip: { is: { status: 'UPCOMING' } } }],
      },
      data: { status: BookingStatus.CANCELLED },
    });
    expect((momo as unknown as { queryRefund: jest.Mock }).queryRefund).toHaveBeenCalledWith(
      'RF-payment-1',
      'RFR-payment-1',
    );
    expect((momo as unknown as { refund: jest.Mock }).refund).not.toHaveBeenCalled();
  });
});

function createRefundTx() {
  return {
    booking: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue({
        status: BookingStatus.CANCELLED,
        promotionId: 'promotion-1',
      }),
    },
    payment: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'payment-1',
        status: PaymentStatus.COMPLETED,
        releasedAt: null,
      }),
    },
    promotion: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
}
