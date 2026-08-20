import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomerPaymentService } from './customer-payment.service';

describe('CustomerPaymentService invariants', () => {
  const config = {
    get: jest.fn((key: string) =>
      ({
        PLATFORM_USER_ID: 'platform-user-id',
        MOCK_PAYMENTS_ENABLED: 'true',
        NODE_ENV: 'test',
      })[key],
    ),
    getOrThrow: jest.fn(() => 'platform-user-id'),
  } as unknown as ConfigService;

  it('rejects a booking payment when the stored total is fractional VND', async () => {
    const db = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          customerId: 'customer-1',
          status: BookingStatus.APPROVED,
          totalPrice: 100000.5,
        }),
      },
      payment: { findFirst: jest.fn(), create: jest.fn() },
    } as unknown as PrismaService;
    const service = new CustomerPaymentService(db, config);

    await expect(
      service.createPayment('customer-1', {
        bookingId: 'booking-1',
        paymentMethod: 'MOCK_QR',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((db as unknown as { payment: { create: jest.Mock } }).payment.create).not.toHaveBeenCalled();
  });

  it('reuses a pending payment instead of creating a concurrent attempt', async () => {
    const pending = {
      id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      bookingId: 'booking-1',
      userId: 'customer-1',
      amount: 100000,
      paymentMethod: 'MOMO',
      status: PaymentStatus.PENDING,
      createdAt: new Date(),
    };
    const payment = {
      findFirst: jest.fn().mockResolvedValue(pending),
      create: jest.fn(),
    };
    const db = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          customerId: 'customer-1',
          status: BookingStatus.APPROVED,
          totalPrice: 100000,
        }),
      },
      payment,
    } as unknown as PrismaService;
    const service = new CustomerPaymentService(db, config);

    await expect(
      service.createPayment('customer-1', {
        bookingId: 'booking-1',
        paymentMethod: 'MOMO',
      }),
    ).resolves.toBe(pending);
    expect(payment.create).not.toHaveBeenCalled();
  });

  it('creates a new attempt after a terminal failed payment without overwriting history', async () => {
    const failed = {
      id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
      bookingId: 'booking-1',
      userId: 'customer-1',
      amount: 100000,
      paymentMethod: 'MOMO',
      transactionId: 'PAY-OLD',
      status: PaymentStatus.FAILED,
      createdAt: new Date('2026-08-20T00:00:00.000Z'),
    };
    const created = {
      id: 'cccccccccccccccccccccccc',
      bookingId: 'booking-1',
      userId: 'customer-1',
      amount: 100000,
      paymentMethod: 'MOMO',
      transactionId: 'PAY-NEW',
      status: PaymentStatus.PENDING,
    };
    const payment = {
      findFirst: jest.fn().mockResolvedValue(failed),
      create: jest.fn().mockResolvedValue(created),
      findUnique: jest.fn(),
    };
    const db = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          customerId: 'customer-1',
          status: BookingStatus.APPROVED,
          totalPrice: 100000,
        }),
      },
      payment,
    } as unknown as PrismaService;
    const service = new CustomerPaymentService(db, config);

    await expect(
      service.createPayment('customer-1', {
        bookingId: 'booking-1',
        paymentMethod: 'MOMO',
      }),
    ).resolves.toBe(created);

    expect(payment.create).toHaveBeenCalledTimes(1);
    const data = payment.create.mock.calls[0][0].data;
    expect(data.id).not.toBe(failed.id);
    expect(data.transactionId).not.toBe(failed.transactionId);
    expect(data.status).toBe(PaymentStatus.PENDING);
    expect(data.bookingId).toBe('booking-1');
  });

  it('allows switching payment method only after the previous attempt failed', async () => {
    const payment = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
        bookingId: 'booking-1',
        userId: 'customer-1',
        amount: 100000,
        paymentMethod: 'MOMO',
        status: PaymentStatus.FAILED,
        createdAt: new Date(),
      }),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      findUnique: jest.fn(),
    };
    const db = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          customerId: 'customer-1',
          status: BookingStatus.APPROVED,
          totalPrice: 100000,
        }),
      },
      payment,
    } as unknown as PrismaService;
    const service = new CustomerPaymentService(db, config);

    const result = await service.createPayment('customer-1', {
      bookingId: 'booking-1',
      paymentMethod: 'MOCK_QR',
    });

    expect(result.paymentMethod).toBe('MOCK_QR');
    expect(result.status).toBe(PaymentStatus.PENDING);
  });

  it('does not credit a wallet top-up when the payment claim is already consumed', async () => {
    const tx = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment-1',
          bookingId: null,
          userId: 'customer-1',
          paymentMethod: 'MOCK_QR',
          transactionId: 'TOPUP-test',
          status: PaymentStatus.PENDING,
          amount: 100000,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn(),
      },
      wallet: { upsert: jest.fn() },
      walletTransaction: { create: jest.fn() },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new CustomerPaymentService(db, config);

    await expect(service.confirmMockWalletTopup('payment-1')).rejects.toThrow();
    expect(tx.wallet.upsert).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('never enables mock payments in production', () => {
    const productionConfig = {
      get: jest.fn((key: string) =>
        ({
          PLATFORM_USER_ID: 'platform-user-id',
          MOCK_PAYMENTS_ENABLED: 'true',
          NODE_ENV: 'production',
        })[key],
      ),
      getOrThrow: jest.fn(() => 'platform-user-id'),
    } as unknown as ConfigService;
    const db = {} as PrismaService;

    const service = new CustomerPaymentService(db, productionConfig);

    expect(service.isMockPaymentsEnabled()).toBe(false);
  });
});
