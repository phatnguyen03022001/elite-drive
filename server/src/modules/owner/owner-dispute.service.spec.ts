import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DisputeStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OwnerDisputeService } from './owner-dispute.service';

describe('OwnerDisputeService invariants', () => {
  it('rejects a booking-linked case outside the owner fleet', async () => {
    const db = {
      booking: { findFirst: jest.fn().mockResolvedValue(null) },
      dispute: { create: jest.fn() },
    } as unknown as PrismaService;
    const service = new OwnerDisputeService(db);

    await expect(
      service.create('owner-1', {
        type: 'BOOKING_SUPPORT',
        bookingId: 'booking-1',
        title: 'Need help',
        description: 'Vehicle handover issue',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(
      (db as unknown as { dispute: { create: jest.Mock } }).dispute.create,
    ).not.toHaveBeenCalled();
  });

  it('creates an owner support case without external services', async () => {
    const dispute = { create: jest.fn().mockResolvedValue({ id: 'case-1' }) };
    const db = { dispute } as unknown as PrismaService;
    const service = new OwnerDisputeService(db);

    await service.create('owner-1', {
      type: 'ACCOUNT_SUPPORT',
      title: 'Profile issue',
      description: '  Bank details need review  ',
    });

    expect(dispute.create).toHaveBeenCalledWith({
      data: {
        bookingId: null,
        initiatedBy: 'owner-1',
        title: '[ACCOUNT_SUPPORT] Profile issue',
        description: 'Bank details need review',
        status: DisputeStatus.OPEN,
      },
    });
  });

  it('rejects whitespace-only messages before opening a transaction', async () => {
    const db = { $transaction: jest.fn() } as unknown as PrismaService;
    const service = new OwnerDisputeService(db);

    await expect(service.respond('owner-1', 'dispute-1', '   ')).rejects.toBeInstanceOf(BadRequestException);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a dispute outside the owner visibility boundary', async () => {
    const tx = { dispute: { findFirst: jest.fn().mockResolvedValue(null) } };
    const db = { $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    const service = new OwnerDisputeService(db);

    await expect(service.respond('owner-1', 'dispute-1', 'message')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects responses after the dispute is resolved', async () => {
    const tx = {
      dispute: { findFirst: jest.fn().mockResolvedValue({ id: 'dispute-1', status: DisputeStatus.RESOLVED }), updateMany: jest.fn() },
      disputeMessage: { create: jest.fn() },
    };
    const db = { $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    const service = new OwnerDisputeService(db);

    await expect(service.respond('owner-1', 'dispute-1', 'late response')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.dispute.updateMany).not.toHaveBeenCalled();
    expect(tx.disputeMessage.create).not.toHaveBeenCalled();
  });

  it('moves an open dispute to in-progress before creating the message', async () => {
    const tx = {
      dispute: { findFirst: jest.fn().mockResolvedValue({ id: 'dispute-1', status: DisputeStatus.OPEN }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      disputeMessage: { create: jest.fn().mockResolvedValue({ id: 'message-1' }) },
    };
    const db = { $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    const service = new OwnerDisputeService(db);

    await service.respond('owner-1', 'dispute-1', '  owner response  ');
    expect(tx.dispute.updateMany).toHaveBeenCalledWith({
      where: { id: 'dispute-1', status: { in: [DisputeStatus.OPEN, DisputeStatus.IN_PROGRESS] } },
      data: { status: DisputeStatus.IN_PROGRESS },
    });
    expect(tx.disputeMessage.create).toHaveBeenCalledWith({ data: { disputeId: 'dispute-1', senderId: 'owner-1', message: 'owner response' } });
  });

  it('does not write a message when the status claim loses a race', async () => {
    const tx = {
      dispute: { findFirst: jest.fn().mockResolvedValue({ id: 'dispute-1', status: DisputeStatus.IN_PROGRESS }), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      disputeMessage: { create: jest.fn() },
    };
    const db = { $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    const service = new OwnerDisputeService(db);

    await expect(service.respond('owner-1', 'dispute-1', 'message')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.disputeMessage.create).not.toHaveBeenCalled();
  });
});
