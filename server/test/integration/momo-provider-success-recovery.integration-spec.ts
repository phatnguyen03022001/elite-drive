import request from 'supertest';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import {
  createIntegrationApp,
  resetIntegrationDatabase,
} from './test-database';
import { IDS, PASSWORD, seedBookingPayment, seedCar, seedUsers } from './fixtures';

describe('MoMo provider-success recovery', () => {
  const fakeMomo = {
    isEnabled: jest.fn().mockReturnValue(true),
    queryStatus: jest.fn(),
    refund: jest.fn(),
    queryRefund: jest.fn(),
  };
  let app: Awaited<ReturnType<typeof createIntegrationApp>>['app'];
  let prisma: Awaited<ReturnType<typeof createIntegrationApp>>['prisma'];

  beforeAll(async () => {
    ({ app, prisma } = await createIntegrationApp(fakeMomo));
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    fakeMomo.isEnabled.mockReturnValue(true);
    await resetIntegrationDatabase(prisma);
    await seedUsers(prisma);
    await seedCar(prisma);
    await seedBookingPayment(prisma);
    await prisma.booking.update({
      where: { id: IDS.booking },
      data: { status: BookingStatus.CANCELLED },
    });
    await prisma.payment.update({
      where: { id: IDS.payment },
      data: {
        paymentMethod: 'MOMO',
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(201);
    return agent;
  }

  it('durably records cancellation conflict, then refunds it without local escrow', async () => {
    fakeMomo.queryStatus.mockResolvedValue({
      resultCode: 0,
      amount: 1000000,
      transId: 900001,
      message: 'Successful.',
    });
    fakeMomo.refund.mockResolvedValue({
      resultCode: 0,
      amount: 1000000,
      transId: 900002,
      message: 'Refunded.',
    });

    const admin = await login('integration.admin@example.com');
    await request(app.getHttpServer())
      .post('/api/admin/payments/momo/reconcile')
      .set('Origin', 'http://localhost:3000')
      .expect(401);
    await admin
      .post('/api/admin/payments/momo/reconcile')
      .set('Origin', 'http://localhost:3000')
      .expect(201)
      .expect(({ body }) => expect(body.data.failed).toBe(1));

    const conflict = await prisma.payment.findUniqueOrThrow({ where: { id: IDS.payment } });
    expect(conflict.status).toBe(PaymentStatus.FAILED);
    expect(conflict.providerSuccessConflictAt).not.toBeNull();
    expect(conflict.providerSuccessResultCode).toBe(0);
    expect(conflict.providerTransactionId).toBe('900001');
    expect(await prisma.wallet.count()).toBe(0);

    await admin
      .post(`/api/admin/payments/momo/conflicts/${IDS.payment}/recover`)
      .set('Origin', 'http://localhost:3000')
      .expect(201)
      .expect(({ body }) =>
        expect(body.data).toEqual(expect.objectContaining({ disposition: 'REFUNDED' })),
      );

    const refunded = await prisma.payment.findUniqueOrThrow({ where: { id: IDS.payment } });
    expect(refunded.status).toBe(PaymentStatus.REFUNDED);
    expect(refunded.refundOrderId).toBe(`RF-${IDS.payment}`);
    expect(refunded.refundRequestId).toBe(`RFR-${IDS.payment}`);
    expect(await prisma.wallet.count()).toBe(0);
    expect(await prisma.walletTransaction.count()).toBe(0);
    expect(fakeMomo.refund).toHaveBeenCalledTimes(1);
  });

  it('denies customer and owner recovery while allowing an admin request to reach the action', async () => {
    const customer = await login('integration.customer@example.com');
    const owner = await login('integration.owner@example.com');
    await customer
      .post(`/api/admin/payments/momo/conflicts/${IDS.payment}/recover`)
      .set('Origin', 'http://localhost:3000')
      .expect(403);
    await owner
      .post(`/api/admin/payments/momo/conflicts/${IDS.payment}/recover`)
      .set('Origin', 'http://localhost:3000')
      .expect(403);
  });
});
