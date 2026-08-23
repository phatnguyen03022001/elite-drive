# Environment Contract and Third-Party Providers Design

## Goal

Make Elite Drive's runtime configuration explicit and self-diagnosing, while replacing production-only local fallbacks for uploads and OTP email with real Cloudinary and Brevo integrations. Keep MoMo opt-in and preserve local development without requiring paid/external services.

## Scope

This change covers three related areas:

1. A centralized backend environment contract that validates required and conditional keys at startup and warns about likely app-specific unknown keys.
2. Cloudinary-backed image uploads when enabled, with the current local filesystem implementation retained as the development fallback.
3. Brevo transactional OTP delivery when enabled, with the current local log implementation retained as the development fallback.

The frontend environment example is updated to document its production backend and public application URL contract. Vercel automatic Git deployments remain disabled.

## Runtime environment contract

Create a focused environment-contract module used by NestJS `ConfigModule.forRoot({ validate })`.

### Core keys

These keys are part of the backend contract:

- `NODE_ENV`: optional; defaults to `development`.
- `PORT`: platform-injected runtime port; accepted but not required in local development.
- `APP_PORT`: optional local fallback port.
- `FRONTEND_URL`: required in production.
- `ALLOW_VERCEL_PREVIEWS`: optional boolean-like string, defaults to `false` behavior.
- `DATABASE_URL`: required at runtime.
- `JWT_SECRET`: required; reject known placeholder/default values in production.
- `OTP_HASH_SECRET`: required; reject known placeholder/default values in production.
- `BCRYPT_ROUNDS`: optional numeric configuration.
- `PLATFORM_USER_ID`: required in production; local deterministic fallback remains allowed outside production.
- `MOCK_PAYMENTS_ENABLED`: optional; production code still independently prevents development-only mock behavior.
- `UPLOAD_DIR`: optional local upload directory.
- `UPLOAD_PUBLIC_BASE_URL`: optional local upload URL prefix.
- `SEED_PASSWORD`: development/seed-only and not required by application startup.

Legacy config keys already referenced by the repository (`APP_NAME`, `API_PREFIX`, `JWT_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`) remain recognized so they are not falsely reported as unknown, even where current runtime code does not require them.

### Cloudinary provider keys

- `CLOUDINARY_ENABLED`: optional boolean-like string, default `false`.
- `CLOUDINARY_CLOUD_NAME`: required when `CLOUDINARY_ENABLED=true`.
- `CLOUDINARY_API_KEY`: required when `CLOUDINARY_ENABLED=true`.
- `CLOUDINARY_API_SECRET`: required when `CLOUDINARY_ENABLED=true`.

Official credential reference: https://cloudinary.com/documentation/developer_onboarding_faq_find_credentials

Cloudinary documents Cloud Name as the product-environment identifier and API Key/API Secret as backend credentials. Secrets must never be logged.

### Brevo provider keys

- `BREVO_ENABLED`: optional boolean-like string, default `false`.
- `BREVO_API_KEY`: required when `BREVO_ENABLED=true`.
- `BREVO_SENDER_EMAIL`: required when `BREVO_ENABLED=true`.
- `BREVO_SENDER_NAME`: optional, defaults to `Elite Drive`.

Official references:

- API key and transactional email: https://developers.brevo.com/docs/send-a-transactional-email
- Sender/domain setup: https://developers.brevo.com/docs/getting-started-with-senders-and-domains

Brevo requires an API key for authenticated API requests and a registered/verified sender. The implementation will use inline OTP email content rather than introducing template IDs.

### MoMo provider keys

Keep the existing adapter and contract:

- `MOMO_ENABLED`: optional boolean-like string, default `false`.
- `MOMO_BASE_URL`: optional; sandbox default remains `https://test-payment.momo.vn`.
- `MOMO_PARTNER_CODE`: required when `MOMO_ENABLED=true`.
- `MOMO_ACCESS_KEY`: required when `MOMO_ENABLED=true`.
- `MOMO_SECRET_KEY`: required when `MOMO_ENABLED=true`.
- `MOMO_REDIRECT_URL`: required when `MOMO_ENABLED=true`.
- `MOMO_IPN_URL`: required when `MOMO_ENABLED=true`.
- `MOMO_PARTNER_NAME`: optional.
- `MOMO_STORE_ID`: optional.

Official credential reference: https://developers.momo.vn/v3/docs/payment/onboarding/integration-process/

MoMo documents Partner Code, Access Key, and Secret Key as environment-specific integration credentials. Secret values must never be logged.

## Startup diagnostics

Startup validation must be deterministic and safe:

- Missing core production configuration: throw before Nest finishes booting.
- Provider enabled but required provider key missing: throw before Nest finishes booting.
- Provider disabled but provider credentials present: log a warning, not an error.
- App-specific unknown/likely typo key: log a warning, not an error.
- Never print secret values.
- Do not treat arbitrary operating-system/platform variables as unknown. Cloud Run/Vercel inject many unrelated values (`PATH`, `HOME`, `K_SERVICE`, etc.). Unknown-key checks are limited to Elite Drive's known namespaces/prefixes such as `MOMO_`, `BREVO_`, `CLOUDINARY_`, `JWT_`, `OTP_`, `UPLOAD_`, `APP_`, and explicitly managed keys.
- `PORT` is recognized as a platform-managed key.

Warnings are emitted after configuration loading through a small startup diagnostics function so validation remains testable without relying on Nest logging internals.

## Cloudinary upload design

Add the official `cloudinary` Node SDK as a production dependency.

`UploadService` keeps its current image signature/size validation before any provider call. After validation:

- If `CLOUDINARY_ENABLED=true`, upload the in-memory buffer via `upload_stream`.
- Use a sanitized folder path under an `elite-drive/` namespace.
- Request `resource_type: image`.
- Return Cloudinary's `secure_url`.
- Treat upload failures as an upstream/provider error without exposing credentials.
- The existing local filesystem write/read path remains active when Cloudinary is disabled.

Cloudinary URLs are already absolute HTTPS URLs; local file serving endpoints remain for local-development uploads.

## Brevo mail design

`MailService` becomes configuration-aware:

- If `BREVO_ENABLED=false`, keep the current local log behavior, but only outside production.
- If `BREVO_ENABLED=true`, POST to Brevo's transactional email API using the `api-key` header.
- Use the verified sender email/name from environment configuration.
- Send OTP using simple HTML/text content with the OTP type and code.
- Do not log the OTP in production.
- Network/non-2xx failures surface as a service-unavailable error so auth flows do not claim OTP delivery succeeded when it did not.
- Production with `BREVO_ENABLED=false` is allowed by the environment contract only if the application intentionally runs without real email; however startup diagnostics must emit a prominent warning that OTP email delivery is local-only/unavailable. This avoids unexpectedly breaking deployment while making the missing third party visible.

No additional Brevo SDK dependency is required; Node's built-in `fetch` is sufficient.

## `.env.example` documentation

Update `server/.env.example` so every supported application key is grouped and annotated with:

- `REQUIRED`, `REQUIRED IN PRODUCTION`, `REQUIRED WHEN ENABLED`, or `OPTIONAL`.
- What the value controls.
- Where to obtain third-party credentials, using the official links above.
- Placeholder values only; never real secrets.

Update `client/.env.example` to document:

- `BACKEND_URL=http://localhost:8000` locally and production Cloud Run URL as the production example/comment.
- `NEXT_PUBLIC_APP_URL=http://localhost:3000` locally and the canonical Vercel URL as the production example/comment.
- `NEXT_PUBLIC_MOMO_ENABLED=false` as an optional UI flag that must match backend provider availability.

## Tests

Add unit tests for the environment contract covering:

- production missing core key fails;
- production placeholder/weak known defaults fail;
- enabled Cloudinary missing any required credential fails;
- enabled Brevo missing required API key/sender fails;
- enabled MoMo missing required credential fails;
- disabled providers with configured credentials produce warnings;
- typo-like app-prefixed keys produce warnings;
- unrelated platform variables do not produce warnings;
- secret values are never included in diagnostic messages.

Add `UploadService` tests for:

- local fallback behavior remains unchanged when Cloudinary is disabled;
- Cloudinary-enabled upload returns `secure_url`;
- provider failure is mapped to a safe service error;
- existing file validation still runs before provider upload.

Add `MailService` tests for:

- local development fallback logs OTP only when Brevo is disabled outside production;
- Brevo request includes `api-key`, sender, recipient, subject/content;
- Brevo failure rejects instead of silently succeeding;
- production does not log OTP.

Run backend typecheck, focused tests, full Jest suite, production dependency audit, and build before completion.

## Deployment behavior

This work lands directly on `main`. Vercel automatic Git deployment remains disabled. Backend Cloud Build may run from the `main` update; minimize commits by implementing the code in one implementation commit after the design/plan documents.

No third-party secret is committed. Production credentials must be configured in Cloud Run/secret storage separately after code deployment.
