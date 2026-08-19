# VND storage migration: Float -> BigInt / MongoDB Long

## Why this migration exists

The current application rejects fractional and unsafe VND values at runtime, but several persisted monetary fields are still Prisma `Float` values, which map to MongoDB doubles. VND is an integer currency in this application, so the storage model should ultimately use exact integer values.

With Prisma + MongoDB, `Decimal` is not a supported MongoDB scalar mapping. The target for exact integer VND storage is Prisma `BigInt`, which maps to MongoDB `Long`.

This migration must be staged. A one-commit `Float -> BigInt` schema replacement is not safe because existing MongoDB documents use double values and Prisma returns `BigInt` as JavaScript `bigint`, which cannot be JSON-stringified without explicit conversion.

## Preflight gate

Run:

```bash
npm run money:audit
```

The audit scans all current VND storage fields and fails if any value is fractional, non-finite, outside JavaScript's safe-integer range, or unexpectedly negative.

Do not begin the storage cutover until this audit passes against a production-like database snapshot.

## Migration stages

### Stage 1 — inventory and freeze invariants

1. Keep the existing request/service `assertVndAmount` checks enabled.
2. Run `money:audit` against staging and a sanitized production snapshot.
3. Repair historical fractional/invalid values explicitly; never silently round financial history.
4. Record wallet reconciliation results before any data rewrite.

### Stage 2 — additive shadow fields

Add nullable `BigInt` shadow fields for monetary values instead of replacing existing fields immediately. Examples:

- `Payment.amountVnd`
- `Booking.totalPriceVnd`, `discountAmountVnd`, `finalPriceVnd`
- `Wallet.balanceVnd`
- `WalletTransaction.amountVnd`
- `OwnerTransaction.amountVnd`
- `Settlement.totalEarningsVnd`, `totalPayoutsVnd`, `netAmountVnd`
- VND price/deposit/insurance fields on `Car`
- fixed/minimum VND fields on `Promotion`

Percentage/rating/odometer/fuel values remain numeric and are not part of the money migration.

### Stage 3 — dual write and backfill

1. Update every monetary mutation to write both legacy Float and shadow BigInt values in the same database transaction.
2. Backfill shadow values from legacy values only after the audit confirms they are safe integers.
3. Run a comparison job that requires `Number(bigintShadow) === legacyFloat` for every row while values remain within the safe-integer range.
4. Wallet balance-vs-journal reconciliation must be zero-drift before progressing.

### Stage 4 — read cutover

1. Read from BigInt shadow fields internally.
2. Convert bigint values explicitly at API boundaries. For VND values within the application's safe range, convert through a checked helper; otherwise serialize them as decimal strings.
3. Never pass raw JavaScript `bigint` to `JSON.stringify` / Nest responses.
4. Re-run payment, refund, settlement, withdrawal, wallet and promotion regression suites.

### Stage 5 — remove legacy doubles

Only after dual-write parity has been observed for a full operational window:

1. stop writing legacy Float fields;
2. remove legacy fields in a later schema revision;
3. rename shadow fields to canonical names if desired;
4. run `money:audit`, wallet reconciliation and settlement checks again;
5. retain an export/checksum of pre-cutover financial records for rollback/audit purposes.

## Rollback

Until Stage 5, rollback means switching reads back to the legacy Float fields because both representations are written transactionally. Do not delete legacy fields until the BigInt representation has passed reconciliation in the target environment.

## Production acceptance criteria

- zero `money:audit` violations;
- zero wallet balance-vs-journal drift;
- payment/refund/withdraw/settlement tests green;
- dual-write parity verified for every monetary collection;
- API serialization contains no raw bigint values;
- staging payment and refund E2E completed before production cutover.
