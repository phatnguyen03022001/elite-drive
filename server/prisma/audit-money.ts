import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Violation = {
  model: string;
  id: string;
  field: string;
  value: unknown;
  reason: string;
};

function checkVnd(
  violations: Violation[],
  model: string,
  id: string,
  field: string,
  value: number | null | undefined,
  options: { allowNegative?: boolean } = {},
) {
  if (value === null || value === undefined) return;
  if (!Number.isFinite(value)) {
    violations.push({ model, id, field, value, reason: 'not finite' });
    return;
  }
  if (!Number.isSafeInteger(value)) {
    violations.push({
      model,
      id,
      field,
      value,
      reason: 'not a safe integer VND amount',
    });
    return;
  }
  if (!options.allowNegative && value < 0) {
    violations.push({ model, id, field, value, reason: 'negative amount' });
  }
}

async function main() {
  const violations: Violation[] = [];

  const [cars, bookings, payments, wallets, walletTransactions, promotions, ownerTransactions, settlements] =
    await Promise.all([
      prisma.car.findMany({
        select: {
          id: true,
          pricePerDay: true,
          pricePerHour: true,
          pricePerWeek: true,
          pricePerMonth: true,
          insurance: true,
          depositRequired: true,
        },
      }),
      prisma.booking.findMany({
        select: {
          id: true,
          totalPrice: true,
          discountAmount: true,
          finalPrice: true,
        },
      }),
      prisma.payment.findMany({ select: { id: true, amount: true } }),
      prisma.wallet.findMany({ select: { id: true, balance: true } }),
      prisma.walletTransaction.findMany({ select: { id: true, amount: true } }),
      prisma.promotion.findMany({
        select: {
          id: true,
          discountType: true,
          discountValue: true,
          minBookingAmount: true,
        },
      }),
      prisma.ownerTransaction.findMany({ select: { id: true, amount: true } }),
      prisma.settlement.findMany({
        select: {
          id: true,
          totalEarnings: true,
          totalPayouts: true,
          netAmount: true,
        },
      }),
    ]);

  for (const car of cars) {
    for (const field of [
      'pricePerDay',
      'pricePerHour',
      'pricePerWeek',
      'pricePerMonth',
      'insurance',
      'depositRequired',
    ] as const) {
      checkVnd(violations, 'Car', car.id, field, car[field]);
    }
  }

  for (const booking of bookings) {
    checkVnd(violations, 'Booking', booking.id, 'totalPrice', booking.totalPrice);
    checkVnd(
      violations,
      'Booking',
      booking.id,
      'discountAmount',
      booking.discountAmount,
    );
    checkVnd(violations, 'Booking', booking.id, 'finalPrice', booking.finalPrice);
  }

  for (const payment of payments) {
    checkVnd(violations, 'Payment', payment.id, 'amount', payment.amount);
  }
  for (const wallet of wallets) {
    checkVnd(violations, 'Wallet', wallet.id, 'balance', wallet.balance);
  }
  for (const row of walletTransactions) {
    checkVnd(violations, 'WalletTransaction', row.id, 'amount', row.amount, {
      allowNegative: true,
    });
  }
  for (const promotion of promotions) {
    if (promotion.discountType === 'FIXED') {
      checkVnd(
        violations,
        'Promotion',
        promotion.id,
        'discountValue',
        promotion.discountValue,
      );
    }
    checkVnd(
      violations,
      'Promotion',
      promotion.id,
      'minBookingAmount',
      promotion.minBookingAmount,
    );
  }
  for (const row of ownerTransactions) {
    checkVnd(violations, 'OwnerTransaction', row.id, 'amount', row.amount, {
      allowNegative: true,
    });
  }
  for (const settlement of settlements) {
    checkVnd(
      violations,
      'Settlement',
      settlement.id,
      'totalEarnings',
      settlement.totalEarnings,
    );
    checkVnd(
      violations,
      'Settlement',
      settlement.id,
      'totalPayouts',
      settlement.totalPayouts,
    );
    checkVnd(
      violations,
      'Settlement',
      settlement.id,
      'netAmount',
      settlement.netAmount,
      { allowNegative: true },
    );
  }

  const checked =
    cars.length +
    bookings.length +
    payments.length +
    wallets.length +
    walletTransactions.length +
    promotions.length +
    ownerTransactions.length +
    settlements.length;

  console.log(`Money storage audit checked ${checked} records.`);
  if (violations.length === 0) {
    console.log('PASS: every audited VND field is a safe integer compatible with BigInt/Long migration.');
    return;
  }

  console.error(`FAIL: ${violations.length} monetary storage violations found.`);
  console.error(JSON.stringify(violations.slice(0, 100), null, 2));
  if (violations.length > 100) {
    console.error(`...and ${violations.length - 100} more.`);
  }
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
