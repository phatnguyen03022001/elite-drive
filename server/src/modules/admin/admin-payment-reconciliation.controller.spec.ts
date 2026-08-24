import { PaymentStatus } from '@prisma/client';
import { AdminPaymentReconciliationController } from './admin-payment-reconciliation.controller';

describe('AdminPaymentReconciliationController', () => {
  it('reads open MoMo provider-success conflicts with a bounded limit', async () => {
    const conflicts = [{ id: 'payment-1', status: PaymentStatus.FAILED }];
    const paymentService = {
      listOpenMomoProviderSuccessConflicts: jest.fn().mockResolvedValue(conflicts),
      reconcilePendingMomoPayments: jest.fn(),
    };
    const controller = new AdminPaymentReconciliationController(paymentService as never);

    const result = await controller.listConflicts({ limit: 100 });

    expect(paymentService.listOpenMomoProviderSuccessConflicts).toHaveBeenCalledWith(100);
    expect(result.data).toBe(conflicts);
  });
});
