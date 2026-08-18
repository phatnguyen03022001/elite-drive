import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { SecureOwnerService } from './secure-owner.service';

describe('SecureOwnerService finance invariants', () => {
  const uploadService = {} as UploadService;

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
    const service = new SecureOwnerService(db, uploadService);

    await expect(
      service.requestWithdraw('owner-1', {
        amount: 100000,
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.ownerTransaction.create).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('returns an existing withdraw for the same idempotency key', async () => {
    const existing = {
      id: '507f1f77bcf86cd799439011',
      ownerId: 'owner-1',
      type: 'WITHDRAW',
      amount: 100000,
      status: 'pending',
    };
    const db = {
      ownerTransaction: {
        findUnique: jest.fn().mockResolvedValue(existing),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const service = new SecureOwnerService(db, uploadService);

    const result = await service.requestWithdraw('owner-1', {
      amount: 100000,
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(result).toBe(existing);
    expect((db as unknown as { $transaction: jest.Mock }).$transaction).not.toHaveBeenCalled();
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
    const service = new SecureOwnerService(db, uploadService);

    const result = await service.getEarnings('owner-1', { page: 1, limit: 2 });

    expect(result.total).toBe(12);
    expect(result.totalEarnings).toBe(2500000);
    expect(result.data).toHaveLength(2);
  });
});
