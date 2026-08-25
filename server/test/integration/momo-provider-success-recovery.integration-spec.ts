import request from 'supertest';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import {
  createIntegrationApp,
  resetIntegrationDatabase,
} from './test-database';
import { IDS, PASSWORD, seedBookingPayment, seedCar, seedUsers } from './fixtures';

describe('MoMo provider-success recovery', () => {
  const newerPaymentId = '507f1f77bcf86cd799439109';
  const newerFailedPaymentId = '507f1f77bcf86cd799439110';
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

  it('blocks MoMo retry and MOCK_QR switching when an older conflict is not the latest payment', async () => {
    await prisma.booking.update({
      where: { id: IDS.booking },
      data: { status: BookingStatus.APPROVED },
    });
    await prisma.payment.update({
      where: { id: IDS.payment },
      data: {
        status: PaymentStatus.FAILED,
        paymentMethod: 'MOMO',
        providerTransactionId: '900001',
        providerSuccessConflictAt: new Date('2026-08-20T00:00:00.000Z'),
        providerSuccessResultCode: 0,
        createdAt: new Date('2026-08-20T00:00:00.000Z'),
      },
    });
    await prisma.payment.create({
      data: {
        id: newerFailedPaymentId,
        userId: IDS.customer,
        bookingId: IDS.booking,
        amount: 1000000,
        paymentMethod: 'MOMO',
        status: PaymentStatus.FAILED,
        transactionId: 'INTEGRATION-PAYMENT-FAILED-NEW',
        refundOrderId: `UNUSED-${newerFailedPaymentId}`,
        createdAt: new Date('2026-08-21T00:00:00.000Z'),
      },
    });
    const customer = await login('integration.customer@example.com');
    const before = await prisma.payment.count({ where: { bookingId: IDS.booking } });

    await customer
      .post('/api/customer/payments/create')
      .set('Origin', 'http://localhost:3000')
      .send({ bookingId: IDS.booking, paymentMethod: 'MOMO' })
      .expect(400);
    expect(await prisma.payment.count({ where: { bookingId: IDS.booking } })).toBe(before);

    await customer
      .post('/api/customer/payments/create')
      .set('Origin', 'http://localhost:3000')
      .send({ bookingId: IDS.booking, paymentMethod: 'MOCK_QR' })
      .expect(400);
    expect(await prisma.payment.count({ where: { bookingId: IDS.booking } })).toBe(before);
    expect(await prisma.payment.count({
      where: { bookingId: IDS.booking, status: PaymentStatus.PENDING },
    })).toBe(0);
  });

  it('still creates a retry after an ordinary failed payment without conflict metadata', async () => {
    await prisma.booking.update({
      where: { id: IDS.booking },
      data: { status: BookingStatus.APPROVED },
    });
    await prisma.payment.update({
      where: { id: IDS.payment },
      data: {
        status: PaymentStatus.FAILED,
        paymentMethod: 'MOMO',
        providerSuccessConflictAt: null,
        providerTransactionId: null,
        refundOrderId: `UNUSED-${IDS.payment}`,
        createdAt: new Date('2026-08-20T00:00:00.000Z'),
      },
    });
    const customer = await login('integration.customer@example.com');
    const before = await prisma.payment.count({ where: { bookingId: IDS.booking } });

    await customer
      .post('/api/customer/payments/create')
      .set('Origin', 'http://localhost:3000')
      .send({ bookingId: IDS.booking, paymentMethod: 'MOMO' })
      .expect(201);

    expect(await prisma.payment.count({ where: { bookingId: IDS.booking } })).toBe(before + 1);
    const payments = await prisma.payment.findMany({
      where: { bookingId: IDS.booking },
      orderBy: { createdAt: 'desc' },
    });
    expect(payments[0]).toEqual(expect.objectContaining({
      bookingId: IDS.booking,
      paymentMethod: 'MOMO',
      status: PaymentStatus.PENDING,
    }));
    expect(payments[0].id).not.toBe(IDS.payment);
  });

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

  it('serializes the APPROVED booking claim against completion writes in Mongo', async () => {
    await prisma.booking.update({
      where: { id: IDS.booking },
      data: { status: BookingStatus.APPROVED },
    });
    let releaseA!: () => void;
    let releaseB!: () => void;
    let aClaimed!: () => void;
    let bRead!: () => void;
    const aMayCommit = new Promise<void>((resolve) => { releaseA = resolve; });
    const bMayWrite = new Promise<void>((resolve) => { releaseB = resolve; });
    const aClaimedPromise = new Promise<void>((resolve) => { aClaimed = resolve; });
    const bReadPromise = new Promise<void>((resolve) => { bRead = resolve; });

    const transactionA = prisma.$transaction(async (tx) => {
      const claim = await tx.booking.updateMany({
        where: { id: IDS.booking, status: BookingStatus.APPROVED },
        data: { status: BookingStatus.APPROVED },
      });
      expect(claim.count).toBe(1);
      aClaimed();
      await aMayCommit;
      return 'claim-created';
    });

    await aClaimedPromise;
    const transactionB = prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: IDS.booking } });
      expect(booking.status).toBe(BookingStatus.APPROVED);
      bRead();
      await bMayWrite;
      const completionClaim = await tx.booking.updateMany({
        where: { id: IDS.booking, status: BookingStatus.APPROVED },
        data: { status: BookingStatus.CONFIRMED },
      });
      expect(completionClaim.count).toBe(1);
      return 'completion-created';
    });

    await bReadPromise;
    releaseA();
    await transactionA;
    releaseB();

    const outcomes = await Promise.allSettled([transactionA, transactionB]);
    const fulfilled = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const rejected = outcomes.filter((outcome) => outcome.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.code).toBe('P2034');
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: IDS.booking } })).status)
      .toBe(BookingStatus.APPROVED);
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
        refundOrderId: `UNUSED-${newerPaymentId}`,
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
    const stale = await prisma.payment.findUniqueOrThrow({ where: { id: IDS.payment } });
    const newer = await prisma.payment.findUniqueOrThrow({ where: { id: newerPaymentId } });
    expect(stale.status).not.toBe(PaymentStatus.COMPLETED);
    expect([stale.status, newer.status]).not.toEqual([
      PaymentStatus.COMPLETED,
      PaymentStatus.PENDING,
    ]);
    expect(newer.status)
      .toBe(PaymentStatus.PENDING);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: IDS.booking } })).status)
      .toBe(BookingStatus.APPROVED);
    expect(await prisma.wallet.count()).toBe(0);
    expect(fakeMomo.refund).toHaveBeenCalledTimes(1);
  });

  it('persists REFUND_PENDING and resumes through queryRefund without local effects', async () => {
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
    fakeMomo.refund.mockResolvedValue({
      resultCode: 1000,
      amount: 1000000,
      transId: 900002,
      message: 'Processing.',
    });
    fakeMomo.queryRefund.mockResolvedValue({
      resultCode: 1000,
      refundTrans: [],
    });
    const admin = await login('integration.admin@example.com');

    await admin
      .post(`/api/admin/payments/momo/conflicts/${IDS.payment}/recover`)
      .set('Origin', 'http://localhost:3000')
      .expect(201)
      .expect(({ body }) => expect(body.data.disposition).toBe('REFUND_PENDING'));

    const pending = await prisma.payment.findUniqueOrThrow({ where: { id: IDS.payment } });
    expect(pending.status).toBe(PaymentStatus.FAILED);
    expect(pending.refundOrderId).toBe(`RF-${IDS.payment}`);
    expect(pending.refundRequestId).toBe(`RFR-${IDS.payment}`);
    expect(pending.refundResultCode).toBe(1000);
    expect(await prisma.wallet.count()).toBe(0);
    expect(await prisma.walletTransaction.count()).toBe(0);
    expect(await prisma.contract.count()).toBe(0);
    expect(await prisma.trip.count()).toBe(0);
    expect(fakeMomo.refund).toHaveBeenCalledTimes(1);

    await admin
      .post(`/api/admin/payments/momo/conflicts/${IDS.payment}/recover`)
      .set('Origin', 'http://localhost:3000')
      .expect(201)
      .expect(({ body }) => expect(body.data.disposition).toBe('REFUND_PENDING'));
    expect(fakeMomo.queryRefund).toHaveBeenCalledWith(
      `RF-${IDS.payment}`,
      `RFR-${IDS.payment}`,
    );
    expect(fakeMomo.refund).toHaveBeenCalledTimes(1);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: IDS.payment } })).status)
      .toBe(PaymentStatus.FAILED);
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
