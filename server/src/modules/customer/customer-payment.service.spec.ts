import { ConfigService } from '@nestjs/config';
import { PaymentStatus } from '@prisma/client';
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

  it('does not credit a wallet top-up when the payment claim is already consumed', async () => {
    const tx = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment-1',
          walletId: 'wallet-1',
          paymentMethod: 'MOCK_QR',
          status: PaymentStatus.PENDING,
          amount: 100000,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn(),
      },
      wallet: { update: jest.fn() },
      walletTransaction: { create: jest.fn() },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new CustomerPaymentService(db, config);

    await expect(service.confirmMockWalletTopup('payment-1')).rejects.toThrow();
    expect(tx.wallet.update).not.toHaveBeenCalled();
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
