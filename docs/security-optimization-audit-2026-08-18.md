# Elite Drive — Security & Optimization Audit

Branch: `audit/security-optimize-20260818`

Scope: application code only. `main` and infrastructure code are not modified by this audit branch.

## Executive summary

The current application has multiple high-impact security weaknesses that should be fixed before optimization work. The most urgent issue is missing guard enforcement on `AdminController`: the controller declares `@Roles(UserRole.ADMIN)` but does not apply `JwtAuthGuard`/`RolesGuard`, while Owner and Customer controllers do. Because the application does not register those guards globally, admin authorization metadata is not sufficient by itself.

The payment sandbox also exposes public endpoints that can confirm a payment or wallet top-up from a `payment_id`, which must never be reachable in a production environment.

Authentication hardening is also required: JWT has hard-coded fallback secrets, OTPs are generated with `Math.random()`, stored in plaintext, logged to stdout, have no visible attempt counter/rate limit, and account-existence responses permit email enumeration. The client persists bearer tokens in `localStorage`, increasing the impact of any XSS issue.

## Priority findings

### CRITICAL-01 — Admin routes are missing authentication/authorization guards

Affected: `server/src/modules/admin/admin.controller.ts`, `server/src/app.module.ts`.

`AdminController` uses `@Roles(UserRole.ADMIN)` but does not use `@UseGuards(JwtAuthGuard, RolesGuard)`. `AppModule` does not register them as `APP_GUARD`. In contrast, Customer and Owner controllers explicitly use both guards.

Impact: unauthenticated or non-admin callers may be able to invoke admin operations, including payment release/refund, user activation changes, settlement execution, KYC approval/rejection, withdrawal approval, car approval and platform wallet/report access.

Fix:
1. Apply `@UseGuards(JwtAuthGuard, RolesGuard)` to `AdminController` immediately, or preferably register both guards globally using `APP_GUARD` and mark public routes explicitly.
2. Add integration tests asserting 401 without token, 403 for CUSTOMER/OWNER, and success only for ADMIN on every `/api/admin/**` route.
3. Keep authorization server-side; never rely on frontend route protection.

### CRITICAL-02 — Public sandbox payment confirmation endpoints

Affected: `server/src/modules/customer/customer.controller.ts`.

The routes below are explicitly `@Public()`:
- `GET /api/customer/payments/mock-scan/:payment_id`
- `GET /api/customer/wallet/topup/mock-scan/:payment_id`

They directly invoke payment/top-up confirmation methods.

Impact: if deployed with real state, anyone who obtains or guesses a payment ID can attempt to mark payment/top-up state as completed without authentication.

Fix:
1. Remove these routes from production builds.
2. Gate sandbox behavior behind an explicit server-side `PAYMENT_SANDBOX_ENABLED=true` check that fails closed when missing.
3. Use signed, short-lived one-time tokens even in sandbox mode.
4. For production, only accept provider webhook callbacks with signature verification and idempotency checks.

### HIGH-01 — JWT hard-coded fallback secrets

Affected: `server/src/modules/auth/jwt.strategy.ts`, `server/src/app.module.ts`.

JWT verification falls back to `elite-drive-key`; global signing configuration falls back to `your-secret-key`.

Impact: a missing production secret can result in forgeable or inconsistent tokens.

Fix:
- Remove all fallback secrets.
- Validate required environment variables during startup and terminate if missing/weak.
- Use one canonical JWT configuration source.
- Prefer shorter access-token TTL (for example 15–30 minutes) plus rotation-capable refresh tokens.

### HIGH-02 — OTP generation/storage/logging is weak

Affected: `server/src/modules/auth/auth.service.ts`, Prisma `OTP` model.

Current behavior:
- OTP uses `Math.random()` rather than a cryptographically secure RNG.
- OTP code is stored in plaintext.
- OTP code is logged to stdout.
- No visible attempt counter, lockout or send/verify rate limiting.
- `sendOtp` reveals whether an email exists for login/forgot-password flows.

Impact: brute force, leakage through logs, account enumeration and abuse of mail infrastructure.

Fix:
- Generate OTP with `crypto.randomInt()`.
- Store a hash/HMAC of the OTP rather than the code.
- Remove all OTP logging.
- Add per-IP + per-email send/verify throttles and max attempts.
- Return a generic response for existing/non-existing accounts.
- Consume OTP atomically to prevent replay/race conditions.

### HIGH-03 — Bearer token stored in localStorage

Affected: `client/src/lib/auth.ts`.

The client stores the JWT in `localStorage` for seven days.

Impact: any successful XSS can directly steal the bearer token.

Fix:
- Prefer Secure + HttpOnly + SameSite cookies for session/refresh-token material.
- Keep access tokens short-lived and preferably memory-only if using a token architecture.
- Add CSP and reduce inline/dynamic script exposure.

### HIGH-04 — No explicit upload limits/type validation visible at controller boundary

Affected: Customer/Owner/Admin file interceptors.

File upload interceptors are configured mainly with field counts. No controller-level MIME allowlist, byte-size limit, content signature verification or image decoding validation is visible in the reviewed paths.

Impact: memory/CPU abuse, oversized uploads, malicious file payloads and unsafe downstream processing.

Fix:
- Configure Multer limits (`fileSize`, file count).
- Validate magic bytes/content, not only MIME extension.
- Re-encode images server-side before persistence when possible.
- Store uploads outside the application process and serve via restricted object storage/CDN.

## Medium findings / hardening

### MEDIUM-01 — Swagger and `/docs-json` always exposed

`server/src/main.ts` initializes Swagger and `/docs-json` unconditionally.

Fix: disable in production or require admin/internal access.

### MEDIUM-02 — Password policy is weak

Registration/reset accepts a minimum length of 6 characters.

Fix: increase to at least 10–12 characters, allow passphrases, optionally check breached passwords, and avoid composition rules that reduce usability.

### MEDIUM-03 — Login performs duplicate bcrypt comparison on failure

`login()` may call `bcrypt.compare()` twice for an invalid password due to construction of the error message.

Impact: unnecessary CPU load on an attacker-controlled endpoint.

Fix: calculate `passwordMatches` once and reuse it. Add auth throttling.

### MEDIUM-04 — Database schema uses floating point for money

`Float` is used for payment, wallet, settlement, price and refund amounts.

Impact: precision/rounding errors in financial logic.

Fix: store monetary values as integer minor units (for VND, integer whole VND) or a database decimal type where supported.

### MEDIUM-05 — Indexes should follow real query shapes

Current schema has many single-field indexes, but hot paths commonly filter by multiple dimensions (owner/status/date, customer/status/date, car/date/status, payment status/createdAt, transactions walletId/createdAt).

Fix after profiling:
- add compound indexes based on production query patterns;
- use cursor/keyset pagination for large lists;
- avoid wide `include` graphs and return explicit `select` projections.

## Optimization plan

### Phase 0 — Security gate (must happen first)

1. Fix admin guards and add authorization integration tests.
2. Disable/gate mock payment confirmation routes.
3. Remove JWT fallback secrets and add startup config validation.
4. Harden OTP generation, storage, rate limiting and account-enumeration behavior.
5. Add upload size/type validation.

Exit criteria: no Critical findings remain and auth/payment tests pass.

### Phase 1 — Correctness and financial integrity

1. Convert monetary fields/calculation boundaries away from floating point.
2. Make payment confirmation, wallet credit/debit, refunds, settlement and withdraw processing idempotent.
3. Use atomic database operations/transactions where supported by the data model.
4. Add invariant tests: wallet cannot go negative unintentionally, payment cannot complete twice, settlement cannot release twice, refund cannot exceed captured amount.

### Phase 2 — API/database performance

1. Instrument slow requests and DB query timings first.
2. Replace broad result objects with `select` projections.
3. Add compound indexes from observed filters/sorts.
4. Use cursor pagination for large admin/customer/owner lists.
5. Remove N+1 query patterns by batching/structured fetches.
6. Cache read-heavy public data such as active promotions, locations/categories and stable car metadata where appropriate.

### Phase 3 — Frontend performance

1. Audit client/server component boundaries in Next.js.
2. Lazy-load Chart.js/framer-motion/heavy admin widgets where not needed on first render.
3. Tune TanStack Query `staleTime`, invalidation and request deduplication by data volatility.
4. Use optimized image delivery and explicit dimensions.
5. Track route bundle size and Web Vitals before/after changes.

### Phase 4 — Platform hardening

1. Add Helmet/security headers and a strict Content-Security-Policy.
2. Disable Swagger in production or place behind access control.
3. Add structured redacted logging; never log secrets, OTPs, bearer tokens or KYC payloads.
4. Add rate limiting for auth, payment, upload and expensive search endpoints.
5. Add dependency audit/renovation workflow and secret scanning in CI.
6. Add security-focused test suite for authz, IDOR/BOLA, payment replay, upload abuse and race conditions.

## Recommended implementation order

P0 (immediate): Critical-01, Critical-02, High-01, High-02.

P1: upload validation, token/session architecture, financial idempotency and money representation.

P2: query instrumentation, compound indexes, pagination/projections and frontend bundle optimization.

P3: CSP/security headers, logging/observability and continuous dependency/security automation.

## Scope note

This report was created only on `audit/security-optimize-20260818`. No infrastructure files are intentionally modified by this audit plan.
