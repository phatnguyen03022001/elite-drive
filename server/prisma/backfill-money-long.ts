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
  { collection: 'Promotion', fields: ['minBookingAmount'] },
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

function fixedPromotionUpdateCommand(): Prisma.InputJsonObject {
  return {
    update: 'Promotion',
    updates: [
      {
        q: { discountType: 'FIXED' },
        u: [
          {
            $set: {
              discountValueLong: {
                $convert: {
                  input: '$discountValue',
                  to: 'long',
                  onError: null,
                  onNull: null,
                },
              },
            },
          },
        ],
        multi: true,
      },
      {
        q: { discountType: { $ne: 'FIXED' } },
        u: [{ $unset: 'discountValueLong' }],
        multi: true,
      },
    ],
  };
}

async function mismatchCount(
  collection: string,
  source: string,
  shadow: string,
  extraQuery: Prisma.InputJsonObject = {},
) {
  const result = await prisma.$runCommandRaw({
    count: collection,
    query: {
      ...extraQuery,
      $expr: { $ne: [`$${source}`, `$${shadow}`] },
    },
  });
  const count = result.n;
  if (typeof count !== 'number') {
    throw new Error(`Unexpected count result while verifying ${collection}.${shadow}`);
  }
  return count;
}

async function verifyBackfill() {
  let mismatches = 0;

  for (const plan of plans) {
    for (const field of plan.fields) {
      const shadow = shadowField(field);
      const count = await mismatchCount(plan.collection, field, shadow);
      mismatches += count;
      if (count > 0) {
        console.error(`${plan.collection}.${shadow}: ${count} mismatched records`);
      }
    }
  }

  const fixedDiscountMismatches = await mismatchCount(
    'Promotion',
    'discountValue',
    'discountValueLong',
    { discountType: 'FIXED' },
  );
  mismatches += fixedDiscountMismatches;
  if (fixedDiscountMismatches > 0) {
    console.error(
      `Promotion.discountValueLong: ${fixedDiscountMismatches} FIXED promotion mismatches`,
    );
  }

  if (mismatches > 0) {
    throw new Error(
      `Long shadow backfill verification failed with ${mismatches} mismatches. Float fields remain authoritative; do not cut over.`,
    );
  }

  console.log('PASS: every staged Long shadow equals its authoritative Float VND source.');
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

  const promotionResult = await prisma.$runCommandRaw(
    fixedPromotionUpdateCommand(),
  );
  console.log(
    `Promotion: backfilled discountValueLong for FIXED discounts only; command result=${JSON.stringify(promotionResult)}`,
  );

  await verifyBackfill();

  console.log(
    'Shadow BSON Long backfill complete and verified. Do not change Prisma monetary field types yet. Validate a production-like snapshot, add dual-read/write compatibility, then perform a separate cutover.',
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
