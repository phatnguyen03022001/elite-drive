const { PrismaClient } = require('@prisma/client');

const TARGET_COLLECTION = 'Payment';
const TARGET_INDEX_NAME = 'Payment_refundOrderId_key';
const ACKNOWLEDGEMENT = TARGET_INDEX_NAME;
const ALLOWED_INDEX_FIELDS = new Set(['name', 'key', 'unique', 'sparse', 'v', 'ns']);
const SAFE_FAILURE_MESSAGE = 'Refund index migration failed; database state is not asserted. Re-run --check.';

function formatSuccessResult({ mode, classification, mutated }) {
  if (classification === 'ABSENT' && !mutated) return 'already-absent';
  if (mode === 'apply' && classification === 'LEGACY_MATCH' && mutated) return 'removed';
  if (mode === 'check' && classification === 'LEGACY_MATCH' && !mutated) return 'migration-required';
  throw new Error('Unsupported successful migration result');
}

function safeFailureMessage() {
  return SAFE_FAILURE_MESSAGE;
}

function isLegacyDefinition(index) {
  if (!index || index.name !== TARGET_INDEX_NAME || index.unique !== true) return false;
  const key = index.key;
  if (!key || typeof key !== 'object' || Array.isArray(key)) return false;
  if (Object.keys(key).length !== 1 || key.refundOrderId !== 1) return false;
  if (Object.prototype.hasOwnProperty.call(index, 'partialFilterExpression')) return false;
  if (index.sparse === true) return false;
  return Object.keys(index).every((field) => ALLOWED_INDEX_FIELDS.has(field));
}

function classifyLegacyIndex(indexes) {
  const target = indexes.find((index) => index?.name === TARGET_INDEX_NAME);
  if (!target) return 'ABSENT';
  return isLegacyDefinition(target) ? 'LEGACY_MATCH' : 'UNSAFE_MISMATCH';
}

function assertTargetDatabase(actualDatabaseName, expectedDatabaseName) {
  if (!expectedDatabaseName) throw new Error('EXPECTED_DATABASE_NAME is required for apply mode');
  if (actualDatabaseName !== expectedDatabaseName) {
    throw new Error('Connected database does not match EXPECTED_DATABASE_NAME');
  }
}

async function getConnectedDatabaseName(prisma) {
  const result = await prisma.$runCommandRaw({ dbStats: 1 });
  if (!result || typeof result.db !== 'string' || result.db.length === 0) {
    throw new Error('Could not determine connected database name');
  }
  return result.db;
}

async function listPaymentIndexes(prisma) {
  const result = await prisma.$runCommandRaw({ listIndexes: TARGET_COLLECTION });
  return result?.cursor?.firstBatch ?? [];
}

async function migrateRefundOrderIndex(prisma, options = {}) {
  const mode = options.mode ?? 'check';
  if (mode !== 'check' && mode !== 'apply') throw new Error('Mode must be check or apply');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

  const databaseName = await getConnectedDatabaseName(prisma);
  if (mode === 'apply') {
    assertTargetDatabase(databaseName, options.expectedDatabaseName);
    if (options.acknowledgement !== ACKNOWLEDGEMENT) {
      throw new Error('Exact refund index acknowledgement is required for apply mode');
    }
  }

  const indexes = await listPaymentIndexes(prisma);
  const classification = classifyLegacyIndex(indexes);
  if (classification === 'UNSAFE_MISMATCH') {
    throw new Error('UNSAFE_MISMATCH: target index has an unexpected definition');
  }
  if (mode === 'check' || classification === 'ABSENT') {
    return { databaseName, classification, mutated: false };
  }

  await prisma.$runCommandRaw({ dropIndexes: TARGET_COLLECTION, index: TARGET_INDEX_NAME });
  const remaining = await listPaymentIndexes(prisma);
  if (remaining.some((index) => index?.name === TARGET_INDEX_NAME)) {
    throw new Error('Target index is still present after drop');
  }
  return { databaseName, classification, mutated: true };
}

function parseMode(args) {
  const modes = args.filter((arg) => arg === '--check' || arg === '--apply');
  if (args.some((arg) => !modes.includes(arg)) || modes.length > 1) {
    throw new Error('Usage: node drop-refund-order-id-index.cjs [--check|--apply]');
  }
  return modes[0] ?? '--check';
}

async function main() {
  const mode = parseMode(process.argv.slice(2)) === '--apply' ? 'apply' : 'check';
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (mode === 'apply' && (!process.env.EXPECTED_DATABASE_NAME || !process.env.ALLOW_REFUND_INDEX_DROP)) {
    throw new Error('Apply requires EXPECTED_DATABASE_NAME and ALLOW_REFUND_INDEX_DROP');
  }
  const prisma = new PrismaClient();
  try {
    const result = await migrateRefundOrderIndex(prisma, {
      mode,
      expectedDatabaseName: process.env.EXPECTED_DATABASE_NAME,
      acknowledgement: process.env.ALLOW_REFUND_INDEX_DROP,
    });
    const status = formatSuccessResult({ mode, ...result });
    console.log(`database=${result.databaseName} collection=${TARGET_COLLECTION} index=${TARGET_INDEX_NAME} mode=${mode} classification=${result.classification} result=${status}`);
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = {
  ACKNOWLEDGEMENT,
  formatSuccessResult,
  safeFailureMessage,
  TARGET_COLLECTION,
  TARGET_INDEX_NAME,
  assertTargetDatabase,
  classifyLegacyIndex,
  getConnectedDatabaseName,
  migrateRefundOrderIndex,
};

if (require.main === module) {
  main().catch(() => {
    console.error(safeFailureMessage());
    process.exitCode = 1;
  });
}
