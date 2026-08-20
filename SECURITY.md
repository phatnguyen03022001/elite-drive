# Security Policy

Elite Drive handles authentication, identity-verification data, bookings, payment state, wallet activity, uploads, and administrative operations. Security-sensitive changes are reviewed against the current `main` branch.

## Reporting a vulnerability

Do not publish exploit details, credentials, personal data, or proof-of-concept payloads in a public issue.

Use GitHub private vulnerability reporting or a Security Advisory when available. If private reporting is unavailable, open a minimal issue requesting a private contact channel without including sensitive technical details.

A useful report includes:

- affected route, component, or commit;
- security impact;
- reproducible steps using non-sensitive test data;
- required privileges;
- suggested remediation when known.

## Sensitive areas

Give additional care to:

- JWT authentication and session handling;
- renter, owner, and admin authorization boundaries;
- KYC data and uploaded documents;
- local upload paths and file serving;
- booking ownership checks;
- payment, escrow, settlement, refund, wallet, and withdrawal transitions;
- CORS, CSRF/origin checks, and proxy configuration;
- secrets in Git history or logs;
- injection, SSRF, path traversal, IDOR, and privilege escalation.

## Credentials

Secrets must be supplied through runtime environment configuration and must not be committed.

Removing a credential from the current tree does not make historical exposure safe. Any secret that appeared in Git history, logs, screenshots, build output, or a public deployment must be rotated.

## External-service boundary

Build, tests, and local development must not require a paid SaaS account.

The default runtime uses:

- local MongoDB;
- local filesystem uploads;
- application-log OTP delivery;
- disabled external payment integration.

Optional external integrations must be explicitly enabled and must not weaken the local security model.

## Payment boundary

The payment workflow is a sandbox/domain integration for exercising state transitions. It is not a production payment gateway by default.

A real payment integration requires signed webhook verification, idempotency, replay protection, reconciliation, provider-side transaction validation, and operational monitoring before handling real funds.

## Security expectations for changes

Before release:

1. Run frontend lint, type-check, and build checks.
2. Generate Prisma and run the backend build gate.
3. Confirm runtime uploads, databases, logs, and secrets are not tracked.
4. Verify role-protected routes reject unauthorized access.
5. Verify upload validation and origin protections remain active.
6. Review dependency audit output and runtime errors.

See `docs/release-checklist.md`.
