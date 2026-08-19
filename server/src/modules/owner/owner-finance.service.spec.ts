import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OwnerFinanceService } from './owner-finance.service';

const payout = {
  bankAccountNumber: ' 970412345678 ',
  bankAccountName: ' NGUYEN   VAN A ',
};

const normalizedMetadata = {
  bankAccountNumber: '970412345678',
  bankAccountName: 'NGUYEN VAN A',
};

describe('OwnerFinanceService invariants', () => {
  it('rejects fractional VND withdraw amounts before database access', async () => {
    const db = {
      ownerTransaction: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const service = new OwnerFinanceService(db);

    await expect(
      service.requestWithdraw('owner-1', {
        amount: 50000.5,
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        ...payout,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      (db as unknown as { $transaction: jest.Mock }).$transaction,
    ).not.toHaveBeenCalled();
  });

  it('rejects a blank payout destination before database access', async () => {
    const db = {
      ownerTransaction: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const service = new OwnerFinanceService(db);

    await expect(
      service.requestWithdraw('owner-1', {
        amount: 100000,
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        bankAccountNumber: ' ',
        bankAccountName: ' ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      (db as unknown as { $transaction: jest.Mock }).$transaction,
    ).not.toHaveBeenCalled();
  });

  it('does not create a withdraw when atomic balance reservation fails', async () => {
    const tx = {
      wallet: {
        findUnique: jest.fn().mockResolvedValue({ id: 'wallet-1', balance: 50000 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      ownerTransaction: { create: jest.fn() },
      walletTransaction: { create: jest.fn() },
    };
    const ownerTransaction = {
      findUnique: jest.fn().mockResolvedValue(null),
    };
    const db = {
      ownerTransaction,
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new OwnerFinanceService(db);

    await expect(
      service.requestWithdraw('owner-1', {
        amount: 100000,
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        ...payout,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.ownerTransaction.create).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('returns an existing withdraw only for the same payout destination', async () => {
    const existing = {
      id: '507f1f77bcf86cd799439011',
      ownerId: 'owner-1',
      type: 'WITHDRAW',
      amount: 100000,
      status: 'pending',
      metadata: normalizedMetadata,
    };
    const db = {
      ownerTransaction: {
        findUnique: jest.fn().mockResolvedValue(existing),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const service = new OwnerFinanceService(db);

    const result = await service.requestWithdraw('owner-1', {
      amount: 100000,
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      ...payout,
    });

    expect(result).toBe(existing);
    expect(
      (db as unknown as { $transaction: jest.Mock }).$transaction,
    ).not.toHaveBeenCalled();
  });

  it('rejects replaying an idempotency key with a different amount', async () => {
    const db = {
      ownerTransaction: {
        findUnique: jest.fn().mockResolvedValue({
          id: '507f1f77bcf86cd799439011',
          ownerId: 'owner-1',
          type: 'WITHDRAW',
          amount: 100000,
          status: 'pending',
          metadata: normalizedMetadata,
        }),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const service = new OwnerFinanceService(db);

    await expect(
      service.requestWithdraw('owner-1', {
        amount: 150000,
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        ...payout,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects replaying an idempotency key for a different payout account', async () => {
    const db = {
      ownerTransaction: {
        findUnique: jest.fn().mockResolvedValue({
          id: '507f1f77bcf86cd799439011',
          ownerId: 'owner-1',
          type: 'WITHDRAW',
          amount: 100000,
          status: 'pending',
          metadata: normalizedMetadata,
        }),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const service = new OwnerFinanceService(db);

    await expect(
      service.requestWithdraw('owner-1', {
        amount: 100000,
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        bankAccountNumber: 'DIFFERENT',
        bankAccountName: 'NGUYEN VAN A',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores normalized payout details in the withdrawal and wallet journal metadata', async () => {
    const tx = {
      wallet: {
        findUnique: jest.fn().mockResolvedValue({ id: 'wallet-1', balance: 200000 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      ownerTransaction: {
        create: jest.fn().mockResolvedValue({ id: 'withdraw-1' }),
      },
      walletTransaction: { create: jest.fn().mockResolvedValue({ id: 'journal-1' }) },
    };
    const db = {
      ownerTransaction: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new OwnerFinanceService(db);

    await service.requestWithdraw('owner-1', {
      amount: 100000,
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      ...payout,
      description: '  monthly payout  ',
    });

    expect(tx.ownerTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: 'Withdraw request - monthly payout',
        metadata: expect.objectContaining(normalizedMetadata),
      }),
    });
    expect(tx.walletTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          bankAccountNumber: '970412345678',
        }),
      }),
    });
  });

  it('calculates total earnings from all matching rows, not only current page', async () => {
    const ownerTransaction = {
      findMany: jest.fn().mockResolvedValue([
        { id: 'tx-1', amount: 100000 },
        { id: 'tx-2', amount: 200000 },
      ]),
      count: jest.fn().mockResolvedValue(12),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 2500000 } }),
    };
    const db = { ownerTransaction } as unknown as PrismaService;
    const service = new OwnerFinanceService(db);

    const result = await service.getEarnings('owner-1', { page: 1, limit: 2 });

    expect(result.total).toBe(12);
    expect(result.totalEarnings).toBe(2500000);
    expect(result.data).toHaveLength(2);
  });
});
