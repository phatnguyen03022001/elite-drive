# Elite Drive — Security & Optimization Audit Plan

Date: 2026-08-18
Branch: `audit/security-optimize-20260818`

## Scope and safety constraints

- Audit `client/` and `server/` application code.
- Do not modify `main`.
- Do not modify infrastructure-related code/configuration as part of remediation.
- This document is planning/audit output only; fixes should be isolated into reviewable commits.

## Priority findings

### P0 — Authentication / authorization

1. **JWT secrets have hard-coded fallbacks.** `AppModule`, `AuthModule`, and `JwtStrategy` accept fallback signing/verifying secrets when `JWT_SECRET` is absent. Production should fail closed at startup instead of issuing tokens with a predictable key.
2. **OTP values are generated with `Math.random()` and logged in plaintext.** Replace generation with a cryptographically secure RNG, never log OTPs, store only a keyed hash/digest of the OTP, and add attempt counters + cooldown/rate limiting.
3. **OTP verification mutates `isVerified` for every OTP type.** `verifyOtp()` marks an unverified user verified even for LOGIN/FORGOT_PASSWORD flows. Registration verification should be the only flow allowed to set registration verification state.
4. **Forgot-password verification is not a two-step capability.** `verify-forgot-otp` deletes the OTP and returns the email, while the actual password-reset endpoint independently accepts email+OTP. Redesign around a short-lived, single-use reset grant/token after OTP verification, or keep OTP consumption atomic with password reset.
5. **Account enumeration.** OTP endpoints return `Email không tồn tại` for login/forgot-password, exposing whether an account exists. Return a uniform response and perform equivalent work where practical.
6. **No visible brute-force/rate limiting on public auth endpoints.** Add per-IP and per-identity throttles for login, OTP send, OTP verify, registration, and password reset.
7. **JWT authorization trusts role claims for token lifetime.** For sensitive/admin operations, validate current account status/role or use short-lived access tokens plus revocation/version checks. Seven-day bearer tokens increase blast radius.

### P0 — API exposure / validation

8. **Swagger is always exposed at `/docs` and `/docs-json`.** Gate or disable it in production, or protect it with authentication/network policy.
9. **Global validation configuration is inconsistent.** `GlobalValidationPipe` defines `forbidNonWhitelisted: true`, but `main.ts` creates a different pipe without that option. Use one canonical hardened global pipe.
10. **File upload routes need explicit limits and content validation.** Apply file-size caps, MIME allowlists plus magic-byte/content checks, safe generated object names, and image decoding/re-encoding where appropriate.

### P1 — Frontend security

11. **Missing Content-Security-Policy (CSP).** Add a production CSP tailored to actual script/style/image/API origins.
12. **Image host policy is overly broad.** `remotePatterns` permits HTTPS from `**`; replace with explicit trusted image hosts.
13. **Next image optimization is disabled (`unoptimized: true`).** This sacrifices resizing/format optimization despite AVIF/WebP being configured. Enable optimization where deployment constraints allow it.
14. **Avoid long-lived bearer tokens in JavaScript-readable storage.** Prefer secure, HttpOnly, SameSite cookies for browser sessions where architecture permits; otherwise minimize token lifetime and XSS exposure.

## Performance / architecture plan

### P1 — Database and server hot paths

1. Profile Prisma queries for admin reports, booking search, cars, wallets, settlements, and KYC. Add indexes based on actual `WHERE`, `ORDER BY`, and join/access patterns rather than speculative indexes.
2. Replace sequential independent DB/API operations with bounded parallelism where transactional ordering is unnecessary.
3. Use `$transaction` for financial state transitions (release/refund/withdraw/settlement) so balance, payment, booking and audit state cannot partially update.
4. Make financial operations idempotent using unique operation/idempotency keys and state preconditions.
5. Standardize pagination with strict maximum page size; prefer cursor pagination for large/high-churn tables.
6. Select only fields required by each endpoint; avoid returning large relation graphs and sensitive columns.
7. Remove redundant work in login: bcrypt comparison is currently potentially executed twice on a failed login path.
8. Avoid running both Prisma and Mongoose against the same `DATABASE_URL` unless there is a deliberate dual-datastore design; document ownership of each datastore and remove unused client/runtime overhead.

### P1 — Client performance

9. Re-enable Next.js image optimization and narrow remote image origins.
10. Audit large client bundles: dynamically load charting/admin-only UI and other heavy components that are not required for initial render.
11. Standardize React Query cache/stale times by data volatility; deduplicate repeated requests and invalidate narrowly after mutations.
12. Prefer server-rendered/server-component data access for public read-heavy pages when it reduces client JS and waterfalls.
13. Measure Core Web Vitals before/after changes and keep a small performance budget for initial JS, LCP images, and API latency.

## Remediation sequence

### Phase 1 — Security blockers
- Remove all JWT secret fallbacks and validate required environment configuration at startup.
- Harden OTP generation/storage/verification; remove OTP logging; add throttling and attempt limits.
- Separate registration verification from login/password-reset verification state.
- Redesign password reset around atomic single-use authorization.
- Add auth endpoint rate limiting and uniform account-discovery responses.
- Gate Swagger in production.

### Phase 2 — Authorization and money invariants
- Re-check active user/role for privileged actions.
- Review owner/customer object-level authorization on every resource-by-ID endpoint.
- Make payment/refund/withdraw/settlement transitions transactional and idempotent.
- Add invariant tests for double release, double refund, concurrent withdrawal, stale booking state, and role changes.

### Phase 3 — Input/upload/browser hardening
- Use one strict global validation pipe.
- Add upload limits/content checks.
- Add CSP and narrow image hosts.
- Review session/token storage and CSRF strategy according to final cookie/bearer design.

### Phase 4 — Performance
- Capture query timings and slow-query evidence.
- Add evidence-based DB indexes.
- Fix N+1/redundant queries and over-fetching.
- Enable image optimization and split heavy client bundles.
- Tune React Query caching and pagination.

## Verification gates

Before any remediation PR is mergeable:

- Server build + lint + typecheck/test suite pass.
- Client build + lint + typecheck pass.
- Auth tests cover wrong/expired/reused OTP, brute-force limits, password reset replay, missing JWT secret, expired/revoked token, disabled user, and role downgrade.
- Financial tests cover concurrent/replayed release/refund/withdraw operations.
- Upload tests reject oversized, spoofed MIME, and unsupported content.
- Security headers and production Swagger behavior are integration-tested.
- Performance changes include before/after measurements rather than subjective claims.

## Recommended first implementation batch

Keep the first code-change batch small and reviewable: JWT fail-closed configuration, OTP cryptographic generation + no logging + attempt/cooldown controls, registration-only verification mutation, strict global validation, and production Swagger gating. Do not combine database/index changes or infrastructure changes into that batch.
