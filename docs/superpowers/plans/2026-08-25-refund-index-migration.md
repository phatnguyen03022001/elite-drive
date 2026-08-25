# Refund Index Migration Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an inspect-first, fail-closed tool that removes only the obsolete `Payment_refundOrderId_key` from an explicitly identified Mongo database.

**Architecture:** Keep the repair localized in `server/scripts/drop-refund-order-id-index.mjs`. The script exports pure classification/guard helpers and a Prisma-backed migration function, while its CLI defaults to check mode and requires an exact target name plus acknowledgement for apply mode. A disposable-Mongo Jest integration spec proves the old invariant, repair, idempotency, fail-closed mismatch handling, and restored nullable-payment behavior.

**Tech Stack:** Node.js ESM, `@prisma/client`, MongoDB commands through Prisma `$runCommandRaw`, Jest/ts-jest integration harness.

**Spec:** User-provided task “Prepare safe migration tool for obsolete Payment_refundOrderId_key”.

## Global Constraints

- Do not inspect or modify `server/.env.example`.
- Do not use `dotenv/config`, `prisma db push`, schema synchronization, production/cloud/shared databases, MoMo, Cloud Run, Atlas production resources, or `main`.
- Add no dependencies and no application-source changes.
- Default/check mode is strictly non-mutating.
- Apply requires explicit mode, `DATABASE_URL`, `EXPECTED_DATABASE_NAME`, exact database identity, and `ALLOW_REFUND_INDEX_DROP=Payment_refundOrderId_key`.
- Drop only the exact known legacy definition and verify absence afterward; never recreate it.

---

### Task 1: Add the migration script and package commands

**Files:**
- Create: `server/scripts/drop-refund-order-id-index.cjs`
- Modify: `server/package.json`

**Interfaces:**
- `classifyLegacyIndex(indexes)` returns `ABSENT`, `LEGACY_MATCH`, or `UNSAFE_MISMATCH`.
- `assertTargetDatabase(actualDatabaseName, expectedDatabaseName)` rejects missing/mismatched apply identity.
- `migrateRefundOrderIndex(prisma, options)` performs check or guarded apply.

- [ ] **Step 1: Write the failing integration test**

Add a disposable-Mongo test that creates the exact legacy index, proves a second ordinary null/missing `Payment.refundOrderId` write fails, and expects the exported migration function to classify it and remove it. Include idempotent apply, descending-key same-name rejection, and two null payments after removal.

- [ ] **Step 2: Run the focused integration test to verify it fails**

Run `cd server && NODE_ENV=test DATABASE_URL='<existing local replica-set URL>' npx jest --config test/jest-integration.json --runInBand test/integration/refund-index-migration.integration-spec.ts`.

Expected: the test cannot import/use the missing migration script and fails before any mutation behavior can pass.

- [ ] **Step 3: Implement the minimal fail-closed script**

Use `new PrismaClient()` with no dotenv import. Parse only `--check` or `--apply` (default check), require a non-empty `DATABASE_URL`, use `dbStats` to identify the actual database, and list only `Payment` indexes. Accept only the target name with one ascending `refundOrderId` key, `unique: true`, no partial filter, no true sparse flag, and no unexpected definition fields. In apply mode validate the expected database name and exact acknowledgement before listing indexes, drop exactly the target name with `dropIndexes`, re-list indexes, and require absence. Always disconnect in `finally`; print only safe classification/result fields.

- [ ] **Step 4: Add package scripts**

Add `db:refund-index:check` and `db:refund-index:apply` invoking the script with the corresponding explicit mode.

- [ ] **Step 5: Run the focused integration test to verify it passes**

Run the same focused Jest command and confirm all migration cases pass against the disposable replica set.

### Task 2: Verify the repository-wide acceptance gates

**Files:**
- Test: `server/test/integration/refund-index-migration.integration-spec.ts`

- [ ] **Step 1: Run the full required server checks**

Run `npm run typecheck`, `npm run test:ci`, `npm run test:env-sync`, `npm run build`, `npm run security:audit:prod:report`, and `git diff --check` from `server`/repository as applicable. Record exact counts and audit totals without calling the audit clean.

- [ ] **Step 2: Inspect the final diff and status**

Confirm only the script, package manifest, integration spec, and this plan changed; confirm `schema.prisma`, lockfile, application source, client, and workflows are untouched, and leave the permitted `.env.example` unchanged.

- [ ] **Step 3: Run the two safety/simplicity reviews**

Review default read-only behavior, all apply guards, exact index matching, safe output, absence idempotency, real Mongo evidence, and lack of framework/dependencies/application changes. Correct any critical or important findings and rerun affected checks.
