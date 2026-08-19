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

function checkEqual(
  violations: Violation[],
  model: string,
  id: string,
  field: string,
  actual: number,
  expected: number,
  reason: string,
) {
  if (actual === expected) return;
  violations.push({
    model,
    id,
    field,
    value: { actual, expected },
    reason,
  });
}

async function main() {
  const violations: Violation[] = [];

  const [
    cars,
    bookings,
    payments,
    wallets,
    walletTransactions,
    promotions,
    ownerTransactions,
    settlements,
  ] = await Promise.all([
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
    prisma.payment.findMany({
      select: { id: true, bookingId: true, amount: true },
    }),
    prisma.wallet.findMany({ select: { id: true, balance: true } }),
    prisma.walletTransaction.findMany({
      select: { id: true, walletId: true, amount: true },
    }),
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

  const bookingAmounts = new Map<string, number>();
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

    const payable = booking.finalPrice ?? booking.totalPrice;
    if (Number.isSafeInteger(payable)) bookingAmounts.set(booking.id, payable);
  }

  for (const payment of payments) {
    checkVnd(violations, 'Payment', payment.id, 'amount', payment.amount);
    if (!payment.bookingId) continue;
    const expected = bookingAmounts.get(payment.bookingId);
    if (expected === undefined || !Number.isSafeInteger(payment.amount)) continue;
    checkEqual(
      violations,
      'Payment',
      payment.id,
      'amount',
      payment.amount,
      expected,
      'booking-linked payment amount does not match the booking payable amount',
    );
  }

  for (const wallet of wallets) {
    checkVnd(violations, 'Wallet', wallet.id, 'balance', wallet.balance);
  }

  const journalByWallet = new Map<string, number>();
  for (const row of walletTransactions) {
    checkVnd(violations, 'WalletTransaction', row.id, 'amount', row.amount, {
      allowNegative: true,
    });
    journalByWallet.set(
      row.walletId,
      (journalByWallet.get(row.walletId) ?? 0) + row.amount,
    );
  }

  for (const wallet of wallets) {
    if (!Number.isSafeInteger(wallet.balance)) continue;
    const journalBalance = journalByWallet.get(wallet.id) ?? 0;
    checkEqual(
      violations,
      'Wallet',
      wallet.id,
      'balance',
      wallet.balance,
      journalBalance,
      'wallet balance does not reconcile with the append-only transaction journal',
    );
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

    if (
      Number.isSafeInteger(settlement.totalEarnings) &&
      Number.isSafeInteger(settlement.totalPayouts) &&
      Number.isSafeInteger(settlement.netAmount)
    ) {
      checkEqual(
        violations,
        'Settlement',
        settlement.id,
        'netAmount',
        settlement.netAmount,
        settlement.totalEarnings - settlement.totalPayouts,
        'settlement netAmount must equal totalEarnings - totalPayouts',
      );
    }
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

  console.log(`Money migration preflight checked ${checked} records.`);
  console.log(
    `Reconciled ${wallets.length} wallet balances and checked ${payments.filter((p) => p.bookingId).length} booking-linked payments.`,
  );

  if (violations.length === 0) {
    console.log(
      'PASS: monetary storage and accounting invariants are compatible with the staged BigInt/MongoDB Long migration.',
    );
    return;
  }

  console.error(`FAIL: ${violations.length} monetary migration blockers found.`);
  console.error(JSON.stringify(violations.slice(0, 100), null, 2));
  if (violations.length > 100) {
    console.error(`...and ${violations.length - 100} more.`);
  }
  console.error(
    'Do not backfill or cut over monetary fields until every violation is resolved explicitly; historical values must never be rounded silently.',
  );
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
