# Environment Contract and Third-Party Providers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a self-validating env contract plus opt-in Cloudinary uploads and Brevo OTP email delivery, with accurate env examples and safe startup diagnostics.

**Architecture:** Centralize validation/diagnostics in `server/src/config/env-contract.ts`, wire it into Nest ConfigModule, and keep providers opt-in. Cloudinary is wrapped in a focused upload provider; Brevo uses built-in fetch. Local fallbacks remain for development only.

**Tech Stack:** NestJS 10, TypeScript, Jest, Cloudinary Node SDK, Brevo HTTP API, MoMo existing adapter.

**Spec:** `docs/superpowers/specs/2026-08-24-env-third-party-contract-design.md`

## Global Constraints
- Land directly on `main`.
- Keep Vercel automatic Git deployments disabled.
- Never log secret values.
- Provider credentials are required only when the provider is enabled.
- Unknown app-prefixed keys warn; OS/platform keys do not.
- Missing required production/core config fails before the app serves traffic.

---

### Task 1: Environment contract
**Files:** create `server/src/config/env-contract.ts`, create `server/src/config/env-contract.spec.ts`, modify `server/src/app.module.ts`, `server/src/main.ts`, `server/src/config/app.config.ts`, and `server/src/config/jwt.config.ts`.
- [ ] Add tests for core production requirements, conditional provider requirements, disabled-provider warnings, unknown app-prefixed warnings, and secret redaction.
- [ ] Implement `validateEnvironment`, `collectEnvironmentWarnings`, and startup diagnostics.
- [ ] Wire validation into `ConfigModule.forRoot` and log warnings after Nest configuration loads.

### Task 2: Cloudinary uploads
**Files:** create `server/src/modules/upload/cloudinary-upload.service.ts`, create upload tests, modify `upload.service.ts`, `upload.module.ts`, `package.json`, and `client/next.config.ts`.
- [ ] Add tests for Cloudinary secure URL, safe error mapping, validation-before-provider, and local fallback.
- [ ] Add `cloudinary` production dependency.
- [ ] Implement provider wrapper and route enabled uploads through it.
- [ ] Allow Cloudinary delivery URLs in Next.js image configuration and CSP.

### Task 3: Brevo OTP delivery
**Files:** create `server/src/modules/mail/mail.service.spec.ts`, modify `mail.service.ts`.
- [ ] Add tests for local development logging, Brevo request shape, failure handling, and production no-OTP logging.
- [ ] Implement Brevo transactional send using built-in fetch and safe errors.

### Task 4: Environment documentation
**Files:** modify `server/.env.example`, modify `client/.env.example`.
- [ ] Document every supported key with REQUIRED/OPTIONAL labels and official credential links.
- [ ] Include production Cloud Run/Vercel examples without secrets.

### Task 5: Verification
- [ ] Run focused tests, typecheck, full Jest, production audit, and build through CI.
- [ ] Confirm no secret values appear in diagnostics and Vercel auto-deploy remains disabled.
