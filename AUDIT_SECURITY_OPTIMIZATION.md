# Elite Drive — Current Audit Baseline

Refreshed: 2026-08-20
Branch: `main`

## Scope

This document tracks the current repository baseline after removing architecture drift and mandatory external-service dependencies.

The default build/test/local path must work without a paid SaaS account.

## Current architecture

- Frontend: Next.js 16 / React 19 / TypeScript.
- Backend: NestJS 10 / Prisma 6 / MongoDB.
- Authentication: JWT + role guards + trusted-origin protection for cookie-authenticated mutations.
- Uploads: local filesystem with size, MIME, signature, random-name, and path-normalization checks.
- OTP delivery: local application log.
- Payments: external provider adapter disabled by default; sandbox/domain behavior remains explicit.
- CI: GitHub Actions on standard `ubuntu-latest` for this public repository.

## Drift removed

### Repository/documentation

- Corrected clone instructions to the current `elite-drive` repository.
- Removed stale claims that runtime storage uses S3/Garage/MinIO/Cloudinary.
- Removed stale Axios documentation from the frontend stack.
- Replaced provider-specific Vercel release requirements with provider-independent release checks.
- Updated security policy and environment examples to match executable behavior.

### Storage

- Removed mandatory Cloudinary runtime configuration.
- Removed Cloudinary and streamifier dependencies.
- Removed unused Garage and MinIO Docker configuration.
- Removed stale MinIO image allowlisting from Next.js configuration.
- Added runtime upload directories to `.gitignore`.

### Mail

- Removed mandatory Brevo runtime configuration.
- Removed the Brevo SDK dependency.
- OTP delivery now has a deterministic local transport suitable for CI and development.

### Dependency hygiene

- Removed obsolete root `package.json` and root `package-lock.json`.
- Removed the stale backend lockfile because it contained dependencies no longer declared by `server/package.json`, including old storage, mail, AWS, Mongoose, and Resend packages.
- Backend CI currently installs from `server/package.json` with `npm install` until a clean lockfile is regenerated in a trusted development environment.

### Local database

- MongoDB Docker configuration and `DATABASE_URL` now agree on replica-set usage for host-based local development.

### CI

- Documentation-only changes are ignored.
- CI does not call email, storage, or payment SaaS APIs.
- Standard Linux runners are retained.

## Security status

Previously remediated controls retained in current `main` include:

- admin authorization guards;
- required JWT secret configuration;
- database-backed role/user validation;
- CSRF/trusted-origin enforcement for cookie-authenticated mutations;
- nested validation-error handling;
- upload authentication and file validation;
- payment state-transition hardening described by the earlier audit history.

## Remaining engineering boundaries

These are explicit boundaries rather than hidden drift:

1. The backend lockfile should be regenerated and committed from a trusted machine with Node.js 24/npm after `npm install`, then CI can return to `npm ci` for the backend.
2. A real email provider, object-storage provider, payment provider, centralized observability service, or hosted database is optional deployment infrastructure and must not become mandatory for local development or CI.
3. The local filesystem upload adapter assumes writable persistent storage. Stateless/serverless deployments must either disable persistent uploads or deliberately configure an optional storage adapter.
4. Production payment handling still requires signed webhooks, idempotency, reconciliation, replay protection, and provider-side transaction validation.

## Quality target

The repository should be reviewed against a semi-senior standard:

- one documented architecture path;
- explicit domain/service boundaries;
- deterministic validation and security checks;
- no dead infrastructure or duplicate dependency ownership;
- tests around security and financial state transitions;
- provider-independent application code;
- no paid external service required for build, test, or local development.
