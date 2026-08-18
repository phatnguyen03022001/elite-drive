# Production Release Checklist

Use this checklist for changes merged or committed directly to `main`.

## 1. Repository state

- Confirm the intended commit is the current `main` SHA.
- Confirm no `.env` file, credential, runtime database state, object-storage data, log file, or `*.tsbuildinfo` file is staged or tracked.
- Review the diff for placeholder copy, fake metrics, hard-coded credentials, and debug-only behavior.

## 2. Frontend validation

```bash
cd client
npm ci
npm run lint
npm run typecheck
npm run build
```

Required outcome: all commands exit successfully.

## 3. Backend validation

```bash
cd server
npm ci
npx prisma generate
npm run build
```

Required outcome: Prisma generation and NestJS compilation exit successfully.

## 4. Configuration review

Frontend:

- `BACKEND_URL` points to the intended API origin.
- `NEXT_PUBLIC_APP_URL` matches the canonical application origin.

Backend:

- `APP_PORT` is set or the `8000` default is acceptable.
- `FRONTEND_URL` is the intended additional browser origin.
- `ALLOW_VERCEL_PREVIEWS` is enabled only when preview-origin access is required.
- database, JWT, email, and storage credentials are provided through the deployment environment.

## 5. CI

Verify the GitHub Actions workflow for the release commit completes successfully:

- frontend lint;
- frontend type-check;
- frontend build;
- Prisma generation;
- backend build.

## 6. Vercel deployment

- Confirm Vercel created a production deployment for the same Git SHA.
- Wait for the deployment state to become `READY`.
- If it becomes `ERROR`, inspect the build logs and fix the failing commit before considering the release complete.

## 7. Production smoke test

Test the canonical production domain:

```text
https://elite-drive-iota.vercel.app
```

Public checks:

- `/` renders successfully.
- live vehicle inventory loads or shows a legitimate empty/error state.
- search/filter controls respond.
- `/login` renders the English authentication experience.
- `/register` renders renter/owner registration.
- `/forgot-password` renders password recovery.

Authenticated checks when test accounts are available:

- renter booking list and booking creation;
- renter KYC and promotions;
- owner dashboard and fleet management;
- owner booking approval and trip handover;
- admin KYC and vehicle review;
- admin finance, withdrawal, dispute, and promotion operations.

## 8. Security smoke test

- Confirm expected security headers are present on frontend responses.
- Confirm unauthenticated users cannot call protected renter, owner, or admin operations.
- Confirm a renter cannot access owner/admin operations and vice versa.
- Confirm no secret values appear in build or runtime logs.

## 9. Runtime review

Inspect recent production runtime errors after deployment. Investigate unexpected `4xx` spikes, `5xx` responses, proxy failures, authentication errors, or asset failures before closing the release.

## 10. Release complete

A release is complete only when:

- the intended commit is on `main`;
- CI is green;
- the matching Vercel deployment is `READY`;
- public smoke tests pass;
- no new critical runtime errors are present.
