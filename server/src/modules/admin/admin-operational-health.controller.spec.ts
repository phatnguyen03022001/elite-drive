import { PaymentStatus } from '@prisma/client';
import { AdminOperationalHealthController } from './admin-operational-health.controller';

describe('AdminOperationalHealthController', () => {
  it('counts open MoMo provider-success conflicts and raises attention', async () => {
    const count = jest.fn()
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2);
    const db = { payment: { count }, dispute: { count }, ownerTransaction: { count }, settlement: { count } };
    const controller = new AdminOperationalHealthController(db as never);

    const result = await controller.getHealth();

    expect(result.data.queues.openMomoProviderSuccessConflicts).toBe(2);
    expect(result.data.needsAttention).toBe(2);
    expect(result.data.status).toBe('attention');
    expect(count).toHaveBeenCalledWith({ where: {
      paymentMethod: 'MOMO', status: PaymentStatus.FAILED, providerSuccessConflictAt: { not: null },
    }});
  });
});
