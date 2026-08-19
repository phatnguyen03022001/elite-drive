import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CONFIRMATION = 'I_UNDERSTAND';

type CollectionPlan = {
  collection: string;
  fields: readonly string[];
};

const plans: readonly CollectionPlan[] = [
  {
    collection: 'Car',
    fields: [
      'pricePerDay',
      'pricePerHour',
      'pricePerWeek',
      'pricePerMonth',
      'insurance',
      'depositRequired',
    ],
  },
  {
    collection: 'Booking',
    fields: ['totalPrice', 'discountAmount', 'finalPrice'],
  },
  { collection: 'Payment', fields: ['amount'] },
  { collection: 'Wallet', fields: ['balance'] },
  { collection: 'WalletTransaction', fields: ['amount'] },
  {
    collection: 'Promotion',
    fields: ['discountValue', 'minBookingAmount'],
  },
  { collection: 'OwnerTransaction', fields: ['amount'] },
  {
    collection: 'Settlement',
    fields: ['totalEarnings', 'totalPayouts', 'netAmount'],
  },
] as const;

function shadowField(source: string) {
  return `${source}Long`;
}

function updateCommand(plan: CollectionPlan): Prisma.InputJsonObject {
  const set: Record<string, Prisma.InputJsonValue> = {};

  for (const field of plan.fields) {
    set[shadowField(field)] = {
      $convert: {
        input: `$${field}`,
        to: 'long',
        onError: null,
        onNull: null,
      },
    };
  }

  return {
    update: plan.collection,
    updates: [
      {
        q: {},
        u: [{ $set: set }],
        multi: true,
      },
    ],
  };
}

async function main() {
  if (process.env.CONFIRM_MONEY_LONG_BACKFILL !== CONFIRMATION) {
    throw new Error(
      `Refusing to write shadow Long fields. Run money:audit first, then set CONFIRM_MONEY_LONG_BACKFILL=${CONFIRMATION} for the explicit backfill step.`,
    );
  }

  console.log(
    'Starting staged VND shadow-field backfill. Existing Float fields remain authoritative; this command does not cut over application reads/writes.',
  );

  for (const plan of plans) {
    const result = await prisma.$runCommandRaw(updateCommand(plan));
    console.log(
      `${plan.collection}: backfilled ${plan.fields.map((field) => shadowField(field)).join(', ')}; command result=${JSON.stringify(result)}`,
    );
  }

  console.log(
    'Shadow BSON Long backfill complete. Do not change Prisma monetary field types yet. Verify the production-like snapshot, add dual-read/write compatibility, then perform a separate cutover.',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
