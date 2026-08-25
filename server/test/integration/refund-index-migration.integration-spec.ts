import { PaymentStatus } from '@prisma/client';
import { createIntegrationApp, resetIntegrationDatabase } from './test-database';
import { IDS, seedBookingPayment, seedCar, seedUsers } from './fixtures';

const INDEX_NAME = 'Payment_refundOrderId_key';
const SECOND_PAYMENT_ID = '507f1f77bcf86cd799439109';
const THIRD_PAYMENT_ID = '507f1f77bcf86cd799439110';

describe('obsolete Payment refund index migration', () => {
  let app: Awaited<ReturnType<typeof createIntegrationApp>>['app'];
  let prisma: Awaited<ReturnType<typeof createIntegrationApp>>['prisma'];
  let migration: any;
  let databaseName: string;

  beforeAll(async () => {
    ({ app, prisma } = await createIntegrationApp());
    migration = require('../../scripts/drop-refund-order-id-index.cjs');
    databaseName = await migration.getConnectedDatabaseName(prisma);
  });

  beforeEach(async () => {
    await resetIntegrationDatabase(prisma);
    await dropTargetIndexIfPresent();
    await prisma.$runCommandRaw({
      createIndexes: 'Payment',
      indexes: [{ key: { refundOrderId: 1 }, name: INDEX_NAME, unique: true }],
    });
    await seedUsers(prisma);
    await seedCar(prisma);
    await seedBookingPayment(prisma);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  afterEach(async () => {
    if (prisma) await dropTargetIndexIfPresent();
  });

  async function paymentIndexes() {
    const result = (await prisma.$runCommandRaw({ listIndexes: 'Payment' })) as {
      cursor?: { firstBatch?: Array<Record<string, unknown>> };
    };
    return result.cursor?.firstBatch ?? [];
  }

  async function dropTargetIndexIfPresent() {
    if ((await paymentIndexes()).some((index) => index.name === INDEX_NAME)) {
      await prisma.$runCommandRaw({ dropIndexes: 'Payment', index: INDEX_NAME });
    }
  }

  it('proves the legacy null constraint, checks without mutation, applies safely, and is idempotent', async () => {
    await expect(prisma.payment.create({
      data: {
        id: SECOND_PAYMENT_ID,
        userId: IDS.customer,
        bookingId: IDS.booking,
        amount: 1000000,
        paymentMethod: 'MOCK_QR',
        status: PaymentStatus.PENDING,
        transactionId: 'INTEGRATION-PAYMENT-02',
      },
    })).rejects.toThrow();

    expect(migration.classifyLegacyIndex(await paymentIndexes())).toBe('LEGACY_MATCH');
    const checked = await migration.migrateRefundOrderIndex(prisma, { mode: 'check' });
    expect(checked).toEqual(expect.objectContaining({ classification: 'LEGACY_MATCH' }));
    expect((await paymentIndexes()).some((index) => index.name === INDEX_NAME)).toBe(true);
    expect(await prisma.payment.count()).toBe(1);

    const applied = await migration.migrateRefundOrderIndex(prisma, {
      mode: 'apply',
      expectedDatabaseName: databaseName,
      acknowledgement: INDEX_NAME,
    });
    expect(applied).toEqual(expect.objectContaining({ classification: 'LEGACY_MATCH', mutated: true }));
    expect((await paymentIndexes()).some((index) => index.name === INDEX_NAME)).toBe(false);

    const repeated = await migration.migrateRefundOrderIndex(prisma, {
      mode: 'apply',
      expectedDatabaseName: databaseName,
      acknowledgement: INDEX_NAME,
    });
    expect(repeated).toEqual(expect.objectContaining({ classification: 'ABSENT', mutated: false }));

    await prisma.payment.createMany({
      data: [
        {
          id: SECOND_PAYMENT_ID,
          userId: IDS.customer,
          bookingId: IDS.booking,
          amount: 1000000,
          paymentMethod: 'MOCK_QR',
          status: PaymentStatus.PENDING,
          transactionId: 'INTEGRATION-PAYMENT-02',
          refundOrderId: null,
        },
        {
          id: THIRD_PAYMENT_ID,
          userId: IDS.customer,
          bookingId: IDS.booking,
          amount: 1000000,
          paymentMethod: 'MOCK_QR',
          status: PaymentStatus.PENDING,
          transactionId: 'INTEGRATION-PAYMENT-03',
          refundOrderId: null,
        },
      ],
    });
    const nullablePayments = await prisma.payment.findMany({
      where: { id: { in: [SECOND_PAYMENT_ID, THIRD_PAYMENT_ID] } },
      select: { id: true, refundOrderId: true },
    });
    expect(nullablePayments).toHaveLength(2);
    expect(nullablePayments.every((payment) => payment.refundOrderId === null)).toBe(true);
  });

  it('rejects a same-name wrong definition without dropping it or unrelated indexes', async () => {
    await prisma.$runCommandRaw({ dropIndexes: 'Payment', index: INDEX_NAME });
    await prisma.$runCommandRaw({
      createIndexes: 'Payment',
      indexes: [{ key: { refundOrderId: -1 }, name: INDEX_NAME, unique: true }],
    });
    const before = await paymentIndexes();

    await expect(migration.migrateRefundOrderIndex(prisma, {
      mode: 'apply',
      expectedDatabaseName: databaseName,
      acknowledgement: INDEX_NAME,
    })).rejects.toThrow(/UNSAFE_MISMATCH/);

    const after = await paymentIndexes();
    expect(after.some((index) => index.name === INDEX_NAME)).toBe(true);
    expect(after.some((index) => index.name === '_id_')).toBe(true);
    expect(after).toHaveLength(before.length);

    await prisma.$runCommandRaw({ dropIndexes: 'Payment', index: INDEX_NAME });
  });
});
