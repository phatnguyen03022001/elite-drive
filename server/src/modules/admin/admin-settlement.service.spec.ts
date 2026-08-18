import { PrismaService } from '../../prisma/prisma.service';
import { AdminSettlementService } from './admin-settlement.service';

describe('AdminSettlementService invariants', () => {
  it('accounts earnings and completed payouts in the requested calendar month', async () => {
    const user = {
      findMany: jest.fn().mockResolvedValue([{ id: 'owner-1' }]),
    };
    const ownerTransaction = {
      groupBy: jest
        .fn()
        .mockResolvedValueOnce([
          { ownerId: 'owner-1', _sum: { amount: 100000 } },
        ])
        .mockResolvedValueOnce([
          { ownerId: 'owner-1', _sum: { amount: 30000 } },
        ]),
    };
    const settlement = {
      create: jest.fn().mockResolvedValue({ id: 'settlement-1' }),
    };
    const db = { user, ownerTransaction, settlement } as unknown as PrismaService;
    const service = new AdminSettlementService(db);

    await service.run({ period: '2026-08' });

    const range = {
      gte: new Date('2026-08-01T00:00:00.000Z'),
      lt: new Date('2026-09-01T00:00:00.000Z'),
    };
    expect(ownerTransaction.groupBy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          type: 'RENTAL_INCOME',
          status: 'completed',
          createdAt: range,
        }),
      }),
    );
    expect(ownerTransaction.groupBy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          type: 'WITHDRAW',
          status: 'completed',
          OR: [
            { processedAt: range },
            { processedAt: null, updatedAt: range },
            { processedAt: { isSet: false }, updatedAt: range },
          ],
        }),
      }),
    );
    expect(settlement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: 'owner-1',
        period: '2026-08',
        totalEarnings: 100000,
        totalPayouts: 30000,
        netAmount: 70000,
      }),
    });
  });
});
