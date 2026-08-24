import request from 'supertest';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import {
  createIntegrationApp,
  resetIntegrationDatabase,
} from './test-database';
import { IDS, PASSWORD, seedBookingPayment, seedCar, seedUsers } from './fixtures';

describe('MoMo provider-success recovery', () => {
  const newerPaymentId = '507f1f77bcf86cd799439109';
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
      .expect(({ body }) => expect(body.data.disposition).toBe('REFUNDED'));

    const refunded = await prisma.payment.findUniqueOrThrow({ where: { id: IDS.payment } });
    expect(refunded.status).toBe(PaymentStatus.REFUNDED);
    expect(refunded.refundOrderId).toBe(`RF-${IDS.payment}`);
    expect(refunded.refundRequestId).toBe(`RFR-${IDS.payment}`);
    expect(await prisma.wallet.count()).toBe(0);
    expect(await prisma.walletTransaction.count()).toBe(0);
    expect(fakeMomo.refund).toHaveBeenCalledTimes(1);
  });

  it('denies customer and owner recovery while allowing an admin request to reach the action', async () => {
    await request(app.getHttpServer())
      .post(`/api/admin/payments/momo/conflicts/${IDS.payment}/recover`)
      .set('Origin', 'http://localhost:3000')
      .expect(401);
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

  it('completes an authoritative conflict exactly once and replays without duplicates', async () => {
    await prisma.booking.update({
      where: { id: IDS.booking },
      data: { status: BookingStatus.APPROVED },
    });
    await prisma.payment.update({
      where: { id: IDS.payment },
      data: {
        status: PaymentStatus.FAILED,
        providerTransactionId: '900001',
        providerSuccessConflictAt: new Date(),
        providerSuccessResultCode: 0,
      },
    });
    fakeMomo.queryStatus.mockResolvedValue({
      resultCode: 0, amount: 1000000, transId: 900001, message: 'Successful.',
    });
    const admin = await login('integration.admin@example.com');

    await admin
      .post(`/api/admin/payments/momo/conflicts/${IDS.payment}/recover`)
      .set('Origin', 'http://localhost:3000')
      .expect(201)
      .expect(({ body }) => expect(body.data.disposition).toBe('COMPLETED'));

    const first = await Promise.all([
      prisma.payment.findUniqueOrThrow({ where: { id: IDS.payment } }),
      prisma.booking.findUniqueOrThrow({ where: { id: IDS.booking } }),
      prisma.walletTransaction.count({ where: { type: 'ESCROW_HELD' } }),
      prisma.contract.count({ where: { bookingId: IDS.booking } }),
      prisma.trip.count({ where: { bookingId: IDS.booking } }),
    ]);
    expect(first[0].status).toBe(PaymentStatus.COMPLETED);
    expect(first[1].status).toBe(BookingStatus.CONFIRMED);
    expect(first[2]).toBe(1);
    expect(first[3]).toBe(1);
    expect(first[4]).toBe(1);

    await admin
      .post(`/api/admin/payments/momo/conflicts/${IDS.payment}/recover`)
      .set('Origin', 'http://localhost:3000')
      .expect(201)
      .expect(({ body }) => expect(body.data.disposition).toBe('COMPLETED'));
    expect(await prisma.walletTransaction.count({ where: { type: 'ESCROW_HELD' } })).toBe(1);
    expect(await prisma.contract.count({ where: { bookingId: IDS.booking } })).toBe(1);
    expect(await prisma.trip.count({ where: { bookingId: IDS.booking } })).toBe(1);
  });

  it('refunds an old conflict when a newer payment attempt exists', async () => {
    await prisma.booking.update({
      where: { id: IDS.booking },
      data: { status: BookingStatus.APPROVED },
    });
    await prisma.payment.update({
      where: { id: IDS.payment },
      data: {
        status: PaymentStatus.FAILED,
        providerTransactionId: '900001',
        providerSuccessConflictAt: new Date(),
        providerSuccessResultCode: 0,
      },
    });
    await prisma.payment.create({
      data: {
        id: newerPaymentId,
        userId: IDS.customer,
        bookingId: IDS.booking,
        amount: 1000000,
        paymentMethod: 'MOMO',
        status: PaymentStatus.PENDING,
        transactionId: 'INTEGRATION-PAYMENT-NEW',
      },
    });
    fakeMomo.queryStatus.mockResolvedValue({
      resultCode: 0, amount: 1000000, transId: 900001, message: 'Successful.',
    });
    fakeMomo.refund.mockResolvedValue({
      resultCode: 0, amount: 1000000, transId: 900002, message: 'Refunded.',
    });
    const admin = await login('integration.admin@example.com');

    await admin
      .post(`/api/admin/payments/momo/conflicts/${IDS.payment}/recover`)
      .set('Origin', 'http://localhost:3000')
      .expect(201)
      .expect(({ body }) => expect(body.data.disposition).toBe('REFUNDED'));
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: IDS.payment } })).status)
      .toBe(PaymentStatus.REFUNDED);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: newerPaymentId } })).status)
      .toBe(PaymentStatus.PENDING);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: IDS.booking } })).status)
      .toBe(BookingStatus.APPROVED);
    expect(await prisma.wallet.count()).toBe(0);
    expect(fakeMomo.refund).toHaveBeenCalledTimes(1);
  });

  it('resumes a successful provider refund from persisted deterministic intent', async () => {
    await prisma.payment.update({
      where: { id: IDS.payment },
      data: {
        status: PaymentStatus.FAILED,
        providerTransactionId: '900001',
        providerSuccessConflictAt: new Date(),
        providerSuccessResultCode: 0,
        refundOrderId: `RF-${IDS.payment}`,
        refundRequestId: `RFR-${IDS.payment}`,
      },
    });
    fakeMomo.queryStatus.mockResolvedValue({
      resultCode: 0, amount: 1000000, transId: 900001, message: 'Successful.',
    });
    fakeMomo.queryRefund.mockResolvedValue({
      resultCode: 0,
      refundTrans: [{
        orderId: `RF-${IDS.payment}`,
        amount: 1000000,
        resultCode: 0,
        transId: 900002,
      }],
    });
    const admin = await login('integration.admin@example.com');

    await admin
      .post(`/api/admin/payments/momo/conflicts/${IDS.payment}/recover`)
      .set('Origin', 'http://localhost:3000')
      .expect(201)
      .expect(({ body }) => expect(body.data.disposition).toBe('REFUNDED'));
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: IDS.payment } })).status)
      .toBe(PaymentStatus.REFUNDED);
    expect(fakeMomo.queryRefund).toHaveBeenCalledWith(
      `RF-${IDS.payment}`,
      `RFR-${IDS.payment}`,
    );
    expect(fakeMomo.refund).not.toHaveBeenCalled();
    expect(await prisma.wallet.count()).toBe(0);
    expect(await prisma.walletTransaction.count()).toBe(0);
  });

  it('quarantines provider identity mismatch without financial mutation', async () => {
    await prisma.payment.update({
      where: { id: IDS.payment },
      data: {
        status: PaymentStatus.FAILED,
        providerTransactionId: '111',
        providerSuccessConflictAt: new Date(),
        providerSuccessResultCode: 0,
      },
    });
    fakeMomo.queryStatus.mockResolvedValue({
      resultCode: 0, amount: 1000000, transId: 222, message: 'Successful.',
    });
    const admin = await login('integration.admin@example.com');

    await admin
      .post(`/api/admin/payments/momo/conflicts/${IDS.payment}/recover`)
      .set('Origin', 'http://localhost:3000')
      .expect(201)
      .expect(({ body }) => expect(body.data.disposition).toBe('QUARANTINED'));
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: IDS.payment } });
    expect(payment.status).toBe(PaymentStatus.FAILED);
    expect(payment.providerTransactionId).toBe('111');
    expect(await prisma.wallet.count()).toBe(0);
    expect(await prisma.walletTransaction.count()).toBe(0);
    expect(fakeMomo.refund).not.toHaveBeenCalled();
  });
});
