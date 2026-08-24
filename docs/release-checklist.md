# Release Checklist

Use this concise checklist for the lifecycle `dev → local verification → optional shared CI → review/acceptance → exact candidate SHA → explicit promotion to main → explicit deployment → runtime verification`. See [Branch Workflow](branch-workflow.md) and [Platform Runbook](platform-runbook.md) for the operating model and provider procedures.

## 1. Repository state

- Confirm the intended candidate is based on `dev` and capture its exact SHA.
- Confirm `main` and the candidate have not moved since review; promote explicitly only with authorization.
- Confirm no `.env`, credentials, runtime database state, upload data, logs, or generated build state are tracked.
- Review the diff for hard-coded secrets, debug-only behavior, and obsolete infrastructure references.

## 2. Frontend validation

```bash
cd client
npm ci
npm run lint
npm run typecheck
npm run build
```

All commands must exit successfully.

## 3. Backend validation

```bash
cd server
npm install
npx prisma generate
npm run build
```

`npm run build` includes backend type checking, tests, dependency audit reporting, and compilation.

## 4. Configuration review

Frontend:

- `BACKEND_URL` points to the intended API origin.
- `NEXT_PUBLIC_APP_URL` matches the intended web origin.

Backend:

- `DATABASE_URL` targets the intended MongoDB instance.
- JWT and OTP secrets are set through the runtime environment.
- `UPLOAD_DIR` points to writable storage.
- `MOCK_PAYMENTS_ENABLED=false` unless a non-production sandbox test explicitly needs it.
- `MOMO_ENABLED=false` unless the optional provider adapter is deliberately configured.

No Cloudinary, Brevo, Resend, AWS storage, Garage, or MinIO account is required.

## 5. Shared CI and review

When applicable, use GitHub Actions as shared verification after local checks:

- frontend lint;
- frontend type-check;
- frontend build;
- Prisma generation;
- backend type-check/tests/audit/build.

Documentation-only changes should not unnecessarily consume CI. CI success is not promotion or deployment authorization. The current workflows still target `main`; see [Branch Workflow](branch-workflow.md) for the governance gap.

## 6. Deployment and runtime verification

Deployment is explicit and separate from promotion. If a deployment is configured, verify it is built from the same exact Git SHA that passed local/shared verification.

A deployment is not considered healthy merely because a provider accepted the commit. Confirm the application itself starts and serves expected routes.

## 7. Smoke tests

Public:

- `/` renders successfully.
- vehicle inventory loads or shows an intentional empty/error state.
- `/login`, `/register`, and password-recovery routes render.

Authenticated when test accounts are available:

- renter booking and KYC flows;
- owner fleet and booking workflows;
- admin review and finance workflows.

## 8. Security checks

- Protected routes reject unauthenticated access.
- Role boundaries reject unauthorized renter/owner/admin access.
- State-changing cookie requests enforce trusted origins.
- Uploads reject unsupported types and oversized files.
- No secrets appear in logs or generated artifacts.

## 9. Runtime review

After deployment, inspect application errors and unexpected `4xx`/`5xx` responses. Hosting-provider status alone is not a substitute for runtime validation.

## 10. Complete

A release is complete when:

- the explicitly promoted candidate SHA is on `main`;
- CI is green for code changes;
- local or deployed smoke tests pass;
- no new critical runtime/security issue is known.
