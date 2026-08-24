import { BookingStatus, PaymentStatus } from '@prisma/client';
import { CustomerBookingService } from '../../src/modules/customer/customer-booking.service';
import { CustomerPaymentService } from '../../src/modules/customer/customer-payment.service';
import { createIntegrationApp, resetIntegrationDatabase } from './test-database';
import { bookingInput, IDS, seedBookingPayment, seedCar, seedUsers } from './fixtures';

describe('real Mongo persistence and transaction boundaries', () => {
  let app: Awaited<ReturnType<typeof createIntegrationApp>>['app'];
  let prisma: Awaited<ReturnType<typeof createIntegrationApp>>['prisma'];

  beforeAll(async () => {
    ({ app, prisma } = await createIntegrationApp());
  });

  beforeEach(async () => {
    await resetIntegrationDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('persists exactly one active booking for overlapping concurrent requests', async () => {
    await seedUsers(prisma);
    await seedCar(prisma);
    const service = app.get(CustomerBookingService);

    await Promise.allSettled([
      service.createBooking(IDS.customer, bookingInput),
      service.createBooking(IDS.customerTwo, bookingInput),
    ]);

    const activeBookings = await prisma.booking.count({
      where: {
        carId: IDS.car,
        status: { notIn: [BookingStatus.CANCELLED, BookingStatus.REJECTED] },
        startDate: { lt: new Date(bookingInput.endDate) },
        endDate: { gt: new Date(bookingInput.startDate) },
      },
    });
    expect(activeBookings).toBe(1);
  });

  it('preserves Prisma unique indexes when resetting the database', async () => {
    const email = 'integration.index-preservation@example.com';
    await prisma.user.create({
      data: {
        email,
        password: 'integration-password',
      },
    });

    await expect(
      prisma.user.create({
        data: {
          email,
          password: 'integration-password',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('persists payment completion effects once and remains replay-safe', async () => {
    await seedUsers(prisma);
    await seedCar(prisma);
    await seedBookingPayment(prisma);
    const service = app.get(CustomerPaymentService);

    await service.confirmMockPaymentByQr(IDS.payment);
    await service.confirmMockPaymentByQr(IDS.payment);

    expect((await prisma.payment.findUniqueOrThrow({ where: { id: IDS.payment } })).status)
      .toBe(PaymentStatus.COMPLETED);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: IDS.booking } })).status)
      .toBe(BookingStatus.CONFIRMED);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: process.env.PLATFORM_USER_ID! } });
    expect(wallet.balance).toBe(1000000);
    const escrowTransactions = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id, type: 'ESCROW_HELD' },
    });
    expect(escrowTransactions).toHaveLength(1);
    expect(escrowTransactions[0].metadata).toMatchObject({
      paymentId: IDS.payment,
      bookingId: IDS.booking,
      operation: 'PAYMENT_CONFIRMED',
    });
    expect(await prisma.contract.count({ where: { bookingId: IDS.booking } })).toBe(1);
    expect(await prisma.trip.count({ where: { bookingId: IDS.booking } })).toBe(1);
  });
});
