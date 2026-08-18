import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminWithdrawalService } from './admin-withdrawal.service';

describe('AdminWithdrawalService invariants', () => {
  it('rejects a blank payout reference before opening a transaction', async () => {
    const db = { $transaction: jest.fn() } as unknown as PrismaService;
    const service = new AdminWithdrawalService(db);

    await expect(
      service.approve('withdraw-1', { externalReference: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('records the external reference and explicit processed time on approval', async () => {
    const tx = {
      ownerTransaction: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'withdraw-1',
          ownerId: 'owner-1',
          amount: 100000,
          type: 'WITHDRAW',
          status: 'pending',
          externalReference: null,
          processedAt: null,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'withdraw-1',
          status: 'completed',
          externalReference: 'BANK-123',
        }),
      },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new AdminWithdrawalService(db);

    await service.approve('withdraw-1', { externalReference: ' BANK-123 ' });

    expect(tx.ownerTransaction.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'withdraw-1',
        type: 'WITHDRAW',
        status: 'pending',
        processedAt: null,
      },
      data: {
        status: 'completed',
        externalReference: 'BANK-123',
        processedAt: expect.any(Date),
      },
    });
  });

  it('is idempotent when the same completed payout reference is replayed', async () => {
    const existing = {
      id: 'withdraw-1',
      ownerId: 'owner-1',
      amount: 100000,
      type: 'WITHDRAW',
      status: 'completed',
      externalReference: 'BANK-123',
      processedAt: new Date(),
    };
    const tx = {
      ownerTransaction: {
        findUnique: jest.fn().mockResolvedValue(existing),
        updateMany: jest.fn(),
      },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new AdminWithdrawalService(db);

    const result = await service.approve('withdraw-1', {
      externalReference: 'BANK-123',
    });

    expect(result).toBe(existing);
    expect(tx.ownerTransaction.updateMany).not.toHaveBeenCalled();
  });

  it('restores the reserved wallet amount when a pending withdrawal is rejected', async () => {
    const tx = {
      ownerTransaction: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'withdraw-1',
          ownerId: 'owner-1',
          amount: 100000,
          type: 'WITHDRAW',
          status: 'pending',
          processedAt: null,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      wallet: {
        upsert: jest.fn().mockResolvedValue({ id: 'wallet-1' }),
      },
      walletTransaction: {
        create: jest.fn().mockResolvedValue({ id: 'journal-1' }),
      },
    };
    const db = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new AdminWithdrawalService(db);

    await service.reject('withdraw-1', ' Invalid bank account ');

    expect(tx.wallet.upsert).toHaveBeenCalledWith({
      where: { userId: 'owner-1' },
      create: { userId: 'owner-1', balance: 100000 },
      update: { balance: { increment: 100000 } },
    });
    expect(tx.walletTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        walletId: 'wallet-1',
        amount: 100000,
        type: 'WITHDRAW_REJECTED',
      }),
    });
  });
});
