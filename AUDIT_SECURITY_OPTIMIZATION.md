# Elite Drive — Security & Optimization Audit

Branch: `main`

Refreshed: 2026-08-19

Scope: static review of the current `main` security boundaries, with emphasis on authentication/JWT, admin authorization, CSRF/CORS, OTP, uploads, MoMo payment state transitions, and validation behavior. Runtime load testing, production traffic profiling, secret-history scanning, and a fresh dependency CVE scan were not executed as part of this refresh.

## Executive summary

The previous audit was based on `audit/security-optimize-20260818` and no longer described the current `main` accurately. Several former P0/P1 findings have been remediated in the merged code.

No new Critical issue was confirmed in the boundaries reviewed during this refresh. The main remaining authentication risk is the seven-day bearer JWT with no server-side revocation/session record. Additional hardening is still recommended for IP/global rate limiting and upload authorization/quota policy.

## Changes applied during this refresh

### R-01 Cookie-authenticated mutations now require a trusted Origin

`CsrfOriginGuard` already rejected explicit cross-site requests and untrusted origins, but an unsafe request carrying the session cookie could pass when both `Origin` and useful Fetch Metadata were absent.

Current invariant:
- safe methods remain allowed;
- server-to-server requests without the browser session cookie remain allowed;
- unsafe requests carrying the session cookie must include a trusted `Origin`;
- explicit cross-site Fetch Metadata remains rejected.

A regression test covers the missing-Origin case.

### R-02 Nested validation failures no longer assume `constraints` exists

The global validation exception formatter previously accessed `error.constraints` directly. Nested `class-validator` errors can contain a parent node with only `children`, which could turn an intended 400 response into an internal error.

The formatter now recursively walks nested validation errors, preserves the first constraint message per field, and produces dotted property paths such as `profile.email`.

A focused unit test covers a parent validation node without constraints.

## Verified remediations from the previous audit

### Admin authorization

`AdminController` now applies both `JwtAuthGuard` and `RolesGuard` at controller scope and requires `UserRole.ADMIN`. The reviewed operational-health admin controller follows the same pattern.

Status: resolved for the reviewed admin controllers.

### JWT secret fallback and stale role claims

`JwtStrategy` now requires `JWT_SECRET` with `getOrThrow`. Validation reloads the user from the database and rejects inactive or unverified users; the effective role is taken from the current database record rather than trusted only from the JWT claim.

Status: resolved for the reviewed JWT strategy.

### OTP generation, storage, attempts, and cooldown

OTP codes are generated with `crypto.randomInt`, stored as HMAC digests, compared with `timingSafeEqual`, capped by attempt count, protected by resend cooldown, and consumed through a conditional delete.

Status: substantially remediated.

### Upload file validation

The generic image upload endpoint now requires JWT authentication. `UploadService` limits images to 5 MB, allowlists JPEG/PNG/WebP, validates file signatures against MIME type, uses Cloudinary image mode, and generates unique filenames.

Status: former unauthenticated arbitrary-upload finding resolved. Authorization/quota policy remains below.

### Swagger and CORS exposure

Swagger setup is disabled when `NODE_ENV=production`. CORS uses a trusted-origin helper with credentials enabled rather than an unrestricted origin.

Status: former unconditional Swagger exposure resolved; origin configuration must still be maintained correctly in deployment settings.

### MoMo payment callback integrity

The reviewed MoMo IPN path verifies the provider signature, validates amount/order/request identifiers against the local payment, and routes completion through a database transaction with conditional state claims before wallet/trip mutations.

Status: former unsigned public payment-confirmation concern is resolved for the reviewed MoMo IPN path.

## Remaining findings

### H-01 — Seven-day bearer JWT has no server-side revocation

`AuthService.generateTokens()` issues a JWT with a seven-day expiry. Logout clears the browser cookie but there is no reviewed server-side session/token record that can revoke an already-issued bearer token.

Impact: a token copied from a client, log, extension, compromised device, or other leak remains usable until expiry unless the user itself becomes inactive/unverified or the signing secret changes.

Recommended remediation:
1. reduce access-token lifetime to roughly 10–30 minutes;
2. introduce a server-side refresh/session record with rotation and revocation;
3. revoke sessions on logout, password reset, sensitive account changes, and admin deactivation;
4. keep backend database checks for account/role state.

Do not shorten the token on its own if the current client has no compatible refresh/session flow.

### M-01 — No global/per-IP rate limiter is visible in backend dependencies

AuthService has per-email OTP/login guards, which is useful, but the reviewed backend package does not include a global throttling component such as `@nestjs/throttler` or an equivalent distributed limiter.

Impact: distributed requests across many account identifiers can still consume mail, database, upload, and application capacity.

Recommended remediation: enforce per-IP and per-route limits at the application and/or edge layer. For multi-instance production, use a shared store or provider-level limiter rather than process-local memory.

Priority routes: login, OTP send/verify, forgot-password, registration, upload, and expensive public search endpoints.

### M-02 — Login returns the bearer token in JSON as well as an HttpOnly cookie

`AuthController` sets the token in an HttpOnly session cookie but also returns the same token inside the login/OTP-login response payload.

Impact: the session credential is still exposed to JavaScript at login time, reducing the protection gained from an HttpOnly cookie and encouraging client-side bearer-token persistence.

Recommended remediation: choose one authoritative session model. If cookie sessions are the intended model, return user/session metadata without the raw access token and migrate remaining client code away from JS-readable token storage first.

### M-03 — Generic car-image upload has authentication but no business-role/quota boundary

`POST /upload/image` is protected by JWT, but the reviewed controller accepts any authenticated user and always uploads into the `cars` namespace.

Impact: authenticated accounts can consume storage/bandwidth outside a verified car-owner workflow.

Recommended remediation: if this endpoint is exclusively for car media, require the appropriate owner/admin role and enforce per-user/business quotas. If customers legitimately use it, split uploads by purpose and authorize each purpose explicitly.

This is a product-compatibility decision and was not changed automatically in this refresh.

## Areas requiring a dedicated second-pass audit

The previous report also raised financial/data-concurrency concerns in release, refund, withdrawal, settlement, promotion redemption, booking overlap, review integrity, and contract ownership flows. Some of those areas were changed substantially in the merged security branch, so their old findings should not be treated as current without revalidation.

Recommended next pass:
- admin release/refund idempotency and ledger invariants;
- owner withdrawal balance reservation and concurrent requests;
- settlement replay/concurrency behavior;
- booking overlap guarantees under concurrent creates;
- promotion redemption uniqueness/max-use races;
- contract signing ownership and immutable signed-data evidence;
- KYC/private-document object authorization.

## Production verification gates

Before a production release, run at minimum:

```bash
cd server
npm run typecheck
npm run test:ci
npm run security:audit:prod
npm run build

cd ../client
npm run lint
npm run typecheck
npm run build
```

Also verify:
- no secrets or runtime databases/object-storage state are committed;
- unauthorized/wrong-role integration tests cover admin, owner, customer, KYC, upload, and financial routes;
- browser cookie-authenticated mutations reject missing/untrusted Origin;
- dependency and secret scanning run in CI;
- payment/refund/release/withdrawal replay tests and concurrent-state tests pass;
- production smoke tests inspect logs for token, KYC, bank, payment, and OTP data leakage.

## Current priority

1. Design revocable short-lived sessions before changing the seven-day JWT contract.
2. Add distributed per-IP/per-route rate limiting.
3. Decide and enforce upload purpose/role/quota policy.
4. Run the dedicated financial/concurrency second-pass audit.
5. Keep this document tied to `main`; move historical findings to Git history instead of leaving stale Critical items in the active audit report.
