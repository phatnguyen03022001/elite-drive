# Security Policy

Elite Drive is a portfolio-grade full-stack marketplace and should be treated as security-sensitive because it handles authentication, identity-verification documents, booking data, payment state, wallet activity, and administrative operations.

## Supported code

Security fixes are applied to the current `main` branch. Historical commits and older deployment snapshots are not maintained as supported versions.

## Reporting a vulnerability

Please do not publish exploit details, credentials, personal data, or proof-of-concept payloads in a public GitHub issue.

Use GitHub's private vulnerability-reporting / Security Advisory flow for this repository when it is available. If private reporting is not available, open a minimal public issue that requests a private contact channel and contains no sensitive technical details.

A useful report should include:

- the affected route, component, or commit;
- the security impact;
- reproducible steps using non-sensitive test data;
- prerequisites or required privileges;
- suggested remediation when known.

## Sensitive areas

Please give additional care to findings involving:

- authentication or JWT validation;
- renter, owner, or admin authorization boundaries;
- KYC document access;
- file-upload and object-storage paths;
- booking ownership checks;
- payment, escrow, settlement, refund, wallet, or withdrawal state transitions;
- CORS or proxy configuration;
- secrets committed to Git history;
- injection, SSRF, path traversal, insecure direct-object references, or privilege escalation.

## Credentials and historical exposure

Secrets must be provided through environment configuration and must not be committed to the repository.

Removing a credential from the current tree does not make a previously committed credential safe. Any secret that has appeared in Git history, logs, screenshots, build output, or a public deployment must be rotated at the provider.

## Payment boundary

The current payment workflow is a sandbox integration used to exercise product state transitions. It must not be treated as a production payment gateway. A production integration should add signed webhook verification, idempotency, replay protection, reconciliation, provider-side transaction validation, and operational monitoring before handling real payments.

## Security expectations for changes

Before a production release:

1. Run frontend lint, type-check, and build checks.
2. Generate the Prisma client and build the backend.
3. Confirm no secret or runtime database/object-storage state is being committed.
4. Verify role-protected routes reject unauthorized access.
5. Smoke-test the production deployment and inspect runtime errors.

See `docs/release-checklist.md` for the release procedure.
