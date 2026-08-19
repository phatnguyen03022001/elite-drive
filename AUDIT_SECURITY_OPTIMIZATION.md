# Elite Drive — Security & Optimization Audit

Branch: `audit/security-optimize-20260818`

Scope: static source review of `client/`, `server/`, Prisma schema and application configuration. No changes are proposed to infrastructure paths. This audit did not execute the application, dependency vulnerability scanners, load tests, or production traffic profiling, so dependency CVEs and runtime-only issues remain a separate verification step.

## Executive summary

The most urgent risks are authorization and financial-integrity failures. Admin endpoints carry role metadata but do not invoke the JWT/role guards, while the app has no global auth guard. Public sandbox payment confirmation endpoints can mutate payment/wallet state. Several financial operations are not idempotent and perform authorization/balance prechecks outside atomic state transitions.

Recommended order: P0 security containment -> P1 financial/data correctness -> P2 performance/architecture -> P3 hardening and observability.

## P0 — Critical

### S-01 Admin API authorization is not enforced

Evidence:
- `server/src/modules/admin/admin.controller.ts` uses `@Roles(UserRole.ADMIN)` but does not apply `@UseGuards(JwtAuthGuard, RolesGuard)`.
- `server/src/app.module.ts` registers `APP_FILTER`, but no `APP_GUARD` for JWT/roles.
- Admin routes can approve KYC/cars, create promotions, run settlements, release/refund payments, and mutate master data.

Impact: unauthenticated callers can potentially invoke privileged admin operations. `@Roles` only stores metadata; it does not enforce authorization unless `RolesGuard` runs.

Remediation:
1. Prefer global `APP_GUARD` for `JwtAuthGuard` + `RolesGuard`, with `@Public()` as the explicit allowlist.
2. As defense in depth, apply both guards directly to `AdminController`.
3. Add integration tests asserting 401 without token, 403 with wrong role, and success only for ADMIN.

### S-02 Predictable fallback JWT secrets

Evidence:
- `server/src/app.module.ts`: `JWT_SECRET || 'your-secret-key'`.
- `server/src/modules/auth/auth.module.ts` and `jwt.strategy.ts`: fallback `elite-drive-key`.
- JWT configuration is duplicated with different expiry values.

Impact: a missing environment variable can make token forgery practical and configuration behavior inconsistent.

Remediation:
- Remove all fallback secrets; fail application startup when `JWT_SECRET` is missing/weak.
- Keep a single JWT configuration source and validate env at startup.
- Rotate any deployed secret if a fallback may ever have been used.
- Prefer short-lived access tokens plus a properly managed refresh/session mechanism.

### S-03 Public mock payment and wallet-topup confirmation

Evidence:
- `@Public() GET /api/customer/payments/mock-scan/:payment_id` confirms a booking payment.
- `@Public() GET /api/customer/wallet/topup/mock-scan/:payment_id` confirms a wallet top-up.
- Confirmation mutates payment status and wallet balances.

Impact: if reachable outside a disposable demo environment, a caller who obtains/creates a pending payment can mark it paid without a trusted payment provider.

Remediation:
- Compile/register these routes only when an explicit sandbox flag is enabled and `NODE_ENV !== 'production'`.
- In production use provider webhooks with signature verification, replay protection, event IDs and idempotency keys.
- Never use GET for state-changing payment confirmation.

### S-04 Financial operations are replayable / insufficiently constrained

Evidence:
- Admin `releasePayment` does not persist/check a unique release state before crediting the owner and debiting platform escrow.
- `platformFeePercent` and `refundPercent` are externally supplied without strict numeric bounds.
- Payment/refund/release preconditions are often checked before the transaction rather than as an atomic conditional update.

Impact: repeated or concurrent calls can corrupt balances; malformed percentages can create invalid payouts. Combined with S-01 this is especially severe.

Remediation:
- Introduce immutable ledger entries and unique idempotency keys per business event (`release:<bookingId>`, `refund:<paymentId>:<eventId>`).
- Make state transition + balance mutation atomic and conditional on the previous state.
- Validate fee/refund ranges server-side (for example 0..100) and do not accept platform fee policy from an arbitrary request body.
- Prevent negative escrow balances with an atomic condition or ledger-derived balance.

## P1 — High

### S-05 OTP implementation is weak

Evidence in `server/src/modules/auth/auth.service.ts`:
- OTP generated with `Math.random()`.
- OTP stored in plaintext and printed with email to application logs.
- No application rate limiter/throttler is present in server dependencies.
- LOGIN/FORGOT_PASSWORD reveals whether an email exists.
- Successful verification for any OTP purpose can set `isVerified=true`.

Remediation:
- Use `crypto.randomInt`, store only an OTP hash, never log OTP values.
- Add per-IP + per-account send/verify limits, attempt counters, resend cooldown and lockout/backoff.
- Consume OTP atomically once; bind it to one purpose.
- Use generic responses for account-recovery flows to reduce enumeration.
- Add TTL cleanup for expired OTP records.

### S-06 Unauthenticated arbitrary upload endpoint

Evidence:
- `POST /upload/image` has no auth guard.
- Cloudinary upload uses `resource_type: 'auto'` with no visible file size/MIME/dimension validation.

Impact: storage/bandwidth abuse and oversized or unexpected-file uploads.

Remediation:
- Require authorization and business-specific roles.
- Enforce upload byte limits, allowlisted image MIME types, image decoding/validation and dimensions.
- Use image-only upload mode where appropriate; isolate KYC/private documents from public media.

### S-07 Contract signing lacks object-level ownership check

Evidence:
- `CustomerService.signContract(userId, bookingId, ...)` receives `userId` but updates by `bookingId` only.

Impact: an authenticated user who knows another booking ID may sign another customer's contract.

Remediation:
- Resolve/update the contract only through a booking constrained by `customerId=userId` and an allowed booking state.
- Record signer identity, immutable signed payload hash/version and audit timestamp.

### S-08 Withdrawal balance race

Evidence:
- `OwnerService.requestWithdraw` reads wallet balance before entering the transaction, then decrements inside the transaction.

Impact: concurrent withdrawal requests can both pass the precheck and overdraw the wallet.

Remediation:
- Make the sufficient-balance predicate part of the atomic write/transaction.
- Use ledger reservation (`WITHDRAW_PENDING`) with a unique request id and prevent balance from going below zero.

### S-09 Seed has a usable default shared password

Evidence:
- `SEED_PASSWORD || 'LocalSeed!2026'` is used for all seeded users, including the seeded ADMIN account.

Impact: accidental seeding in a shared/production environment yields predictable credentials.

Remediation:
- Require `SEED_PASSWORD` explicitly or generate random per-user passwords printed only to a local seed artifact.
- Refuse destructive/reset seed scripts when `NODE_ENV=production` or when a production-host allowlist check fails.

## P2 — Medium / correctness

### S-10 Client token storage is readable by JavaScript

Active auth stores bearer JWT in a `js-cookie` cookie set from the browser without HttpOnly. A legacy helper also stores an app token in `localStorage`.

Remediation:
- Prefer a server-issued `HttpOnly; Secure; SameSite` session/refresh cookie so XSS cannot directly read the credential.
- Remove the unused localStorage auth helper and keep one session model.
- The Next proxy currently decodes JWT claims without verifying the signature; treat it only as UX routing, never an authorization boundary. Backend must remain authoritative.

### S-11 Swagger is exposed unconditionally

`/docs` and `/docs-json` are enabled at bootstrap for all environments.

Remediation: disable in production, require auth/network restriction, or expose a sanitized public API spec separately.

### S-12 Missing backend hardening baseline

No `helmet`/equivalent security-header middleware or request throttling dependency is visible. CORS optionally trusts every `*.vercel.app` preview while credentials are enabled.

Remediation:
- Add security headers, CSP where compatible, and global/sensitive-route rate limiting.
- Use exact trusted preview origins rather than a broad suffix in production.
- Fail fast on production DB connection failure instead of continuing startup.

### S-13 Review integrity

`CreateReviewDto.bookingId` is optional, so reviews can be created without proving a completed rental. The pre-create duplicate check also lacks a DB uniqueness guarantee.

Remediation: require a completed owned booking and add a unique booking-review constraint.

### S-14 Promotion redemption race / repeat use

`maxUses` is checked before the transaction and there is no redemption entity enforcing one booking/user redemption. Repeated calls can repeatedly discount the same booking; concurrent calls can oversubscribe `maxUses`.

Remediation: add a `PromotionRedemption` record with unique constraints and conditional atomic usage increment.

### S-15 Booking double-booking race

Availability and overlap checks run before the booking create and are not represented by a database uniqueness invariant.

Remediation: model reservable time slots/holds with unique keys or another atomic reservation design. Transaction-only read-then-write is not sufficient unless conflicts are represented by a write constraint.

## P2 — Performance & architecture

### O-01 Use integer money representation

Prisma stores prices, balances, payments and settlements as `Float`. For VND, store integer VND amounts (or a decimal type where appropriate) and centralize arithmetic/rounding policy.

### O-02 Add compound indexes for actual query shapes

Candidate indexes after checking production query plans:
- Booking: `(carId, status, startDate, endDate)` and `(customerId, createdAt)`.
- Payment: `(userId, bookingId, status)`.
- Trip: `(customerId, status, createdAt)`.
- WalletTransaction: `(walletId, createdAt)`.
- OTP: lookup by purpose/account plus expiry; use TTL cleanup for expiry.
- Car marketplace search: evaluate compound indexes around approval/availability/location/category and sort pattern.

Do not add every candidate blindly; validate with MongoDB `explain()` and production-like cardinality.

### O-03 Bound every pagination input

`PaginationDto` correctly caps limit at 50, but some feature DTOs define their own page/limit fields without equivalent `@Max`. Normalize on one bounded pagination DTO. For deep pagination, migrate hot lists from `skip`/offset pagination to cursor pagination.

### O-04 Reduce public car-detail payloads

The list endpoint already limits reviews to 3, but car detail loads all reviews. Return review summary + a first page and paginate reviews separately. Reuse the stored `Car.averageRating`/`totalTrips` where freshness requirements allow.

### O-05 Re-enable/clarify Next image optimization

`next.config.ts` declares AVIF/WebP/device sizes but also sets `images.unoptimized: true`, so built-in optimization is bypassed. Either enable Next image optimization or explicitly document that Cloudinary/CDN performs all transformations. Replace the broad `https://**` remote image pattern with an allowlist.

### O-06 Remove duplicate data-access stack if unused

The app initializes both Mongoose and Prisma against `DATABASE_URL`, while reviewed business services use Prisma. If no Mongoose models remain, remove `MongooseModule` and mongoose dependencies to reduce connection count, startup work and architectural drift.

### O-07 Avoid duplicate DB connection work

`PrismaService.onModuleInit()` calls `$connect()`, and bootstrap manually calls `$connect()` again. Keep lifecycle ownership in one place.

### O-08 Client bundle / rendering pass

Large dashboard pages plus Chart.js and Framer Motion are candidates for dynamic import and server/client boundary cleanup. Measure first with Next bundle analysis/Web Vitals; lazy-load chart-heavy/admin-only modules and keep server-renderable data work out of client bundles.

## P3 — Hardening and maintainability

- Use schema-validated environment configuration at startup; no secret/default fallback in application code.
- Add structured logs with request/correlation IDs and redact credentials, OTP, KYC identifiers, bank details and tokens.
- Add audit events for KYC decisions, admin financial actions, payout/refund state changes and permission failures.
- Add CSRF protection if moving authentication to cookies and accepting cross-site-capable state-changing requests.
- Add dependency scanning/SCA, secret scanning, SAST and lockfile review in CI.
- Add integration tests around authorization matrix, IDOR, payment replay, concurrent booking, concurrent withdraw, promotion redemption and OTP throttling.

## Delivery plan

### Phase 0 — Containment
1. Enforce global auth/role guards and admin integration tests.
2. Disable sandbox payment mutation routes outside local/demo mode.
3. Remove JWT fallback secrets and rotate deployed secrets if required.
4. Guard and restrict uploads.

### Phase 1 — Financial integrity
1. Introduce idempotent payment/refund/release/withdraw state machines.
2. Move money to integer units and centralize ledger operations.
3. Make booking/withdraw/promotion concurrency-safe with DB-enforced invariants.
4. Fix contract ownership enforcement.

### Phase 2 — Auth/privacy hardening
1. Rebuild OTP lifecycle with CSPRNG, hashing, throttling and atomic consumption.
2. Move long-lived credential material away from JS-readable storage.
3. Gate Swagger and tighten CORS/security headers.
4. Add upload/KYC privacy controls and log redaction.

### Phase 3 — Performance
1. Collect Mongo `explain()` output and endpoint latency/payload baselines.
2. Add only validated compound indexes.
3. Cursor-paginate hot lists and reduce review/detail payloads.
4. Measure Next bundles; lazy-load heavy libraries and restore image optimization/CDN transformations.
5. Remove unused Mongoose/duplicate Prisma connection setup.

## Acceptance gates before production

- Every non-public backend endpoint denies unauthenticated access by default.
- ADMIN endpoints return 403 for CUSTOMER/OWNER tokens.
- Payment/refund/release/withdraw requests are idempotent under concurrent replay.
- No public route can create wallet value or mark a payment paid without a trusted provider event.
- OTP values never appear in logs or plaintext storage and are rate-limited.
- Secrets have no hard-coded fallback.
- Money calculations use deterministic integer/decimal semantics.
- Critical workflows have integration + concurrency tests.
- Dependency/secret scans are clean or have documented accepted risk.
