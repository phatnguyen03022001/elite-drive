# Platform Runbook

This is a read-only-first operational guide for Elite Drive's Vercel, MongoDB Atlas, Google Cloud Run, Cloud Build, Artifact Registry, and secret configuration.

## Safety gate

Every operational sequence follows:

> inspect identity → inspect current state → verify intended target → mutate only with explicit authorization → verify resulting state

Commands labelled **read-only inspection** query state. Commands labelled **state-changing** can deploy, alter configuration, change traffic, disable automation, rotate credentials, or delete data; they require explicit authorization and a second verification step. Never put secret values in command history, logs, tickets, or documentation.

## Vercel

The frontend is in `client/`. The committed [`client/vercel.json`](../client/vercel.json) sets `git.deploymentEnabled=false`. This means Git auto-deployment is intentionally off; do not remove or change it casually. The current auto-deployment conclusion is from repository configuration, not a live Vercel API query (the Vercel CLI is not installed in this checkout).

### Read-only inspection

With the Vercel CLI installed and already authenticated, inspect current syntax first:

```bash
vercel --help
vercel project --help
vercel project ls
vercel project inspect <project-name-or-id>
vercel ls <project-name-or-id>
vercel inspect <deployment-url-or-id>
```

Confirm the linked project, account/team, production domain, deployment state, deployment SHA, and environment-variable names. Do not print environment-variable values.

The frontend proxy uses `BACKEND_URL` in `client/next.config.ts`, and production defaults to the Cloud Run URL recorded in source. `NEXT_PUBLIC_APP_URL` controls the canonical frontend origin and `NEXT_PUBLIC_MOMO_ENABLED` is a UI flag that must match backend `MOMO_ENABLED`. Preview and production environments are distinct; verify which environment a variable or deployment belongs to.

### State-changing procedures (authorization required)

Manual deployment should use the repository's approved Vercel command after local verification, with the target environment and exact Git SHA recorded. Do not run it as part of this task. After an authorized deployment, inspect the deployment and verify the frontend, `/api` proxy, backend health, authentication entry points, and expected production domain.

Rollback means directing production to a known-good deployment through the approved Vercel workflow. It is not the same as deleting a deployment or changing Git auto-deployment. Re-enabling Git deployment is a deliberate configuration change: review the trigger branch, production-branch mapping, preview behavior, and duplicate-build risk first, then change `git.deploymentEnabled` only with explicit approval.

## MongoDB Atlas

Atlas account users authenticate to the Atlas control plane; database users authenticate to MongoDB. They are different identities. Discover the organization, project, cluster, topology, tier, database users, network/IP access rules, and backup policy from the Atlas UI or an already authenticated Atlas CLI. The Atlas CLI is not installed locally, so live topology was not verified here.

### Read-only inspection

Use the Atlas UI or, when available, inspect current CLI syntax first:

```bash
atlas --help
atlas projects list
atlas clusters list --projectId <project-id>
atlas accessLists list --projectId <project-id>
```

Inspect connection-string ownership and application configuration without revealing credentials. A redacted shape is:

```text
mongodb+srv://<db-user>:<password>@<cluster>/<database>
```

For safe connectivity verification, use a non-production account and a harmless authenticated metadata query from an approved environment. Prisma reads `DATABASE_URL` from the environment; it does not make a missing, malformed, or network-blocked connection string safe.

Review local development against the local MongoDB example in `server/.env.example`; production must use a separately owned production database and credentials. Check Atlas network access against the egress path used by Cloud Run. Discover backup/restore procedures, retention, point-in-time capability, monitoring alerts, and credential rotation ownership before an incident.

State-changing actions include adding IP access, changing users or roles, changing a cluster, restoring data, and rotating credentials. They require explicit authorization, a recovery plan, and post-change Prisma/application verification.

## Google Cloud identity preflight

Before any Cloud Run or Cloud Build sequence, confirm the active account, project ID, region, intended service/resource, and current revision/state. Read-only discovery examples:

```bash
gcloud auth list
gcloud config get-value project
gcloud run services list
gcloud builds triggers list
gcloud builds list
```

The local gcloud configuration currently reports account `p***@gmail.com` and project `bubbly-area-281517`, but authenticated resource queries could not run because the sandbox could not write gcloud's credential store. Reconfirm these values in an operator environment before acting. The backend service name appears in source as `elite-drive-api`; confirm it live rather than relying on that source reference. Discover the region rather than hard-coding it.

## Cloud Run

The backend listens on `0.0.0.0` and uses the platform `PORT` when available, falling back to `APP_PORT`/8000 as implemented in `server/src/main.ts`. The production target must be confirmed as the intended Cloud Run service and region before deployment.

### Read-only inspection

```bash
gcloud run services list --project <project-id>
gcloud run services describe <service> --region <region> --project <project-id>
gcloud run revisions list --service <service> --region <region> --project <project-id>
gcloud run services describe <service> --region <region> --project <project-id> --format='yaml(status.traffic,status.latestReadyRevisionName,spec.template.metadata.annotations)'
gcloud run services describe <service> --region <region> --project <project-id> --format='yaml(spec.template.spec.containers[].env)'
```

Inspect environment variable names and configuration shape without printing values; redact `DATABASE_URL`, `JWT_SECRET`, `OTP_HASH_SECRET`, payment credentials, Cloudinary, and Brevo values. Inspect min/max instances, concurrency, CPU/memory, ingress, service identity, revision readiness, traffic percentages, request metrics, error rates, network egress, logs, and billing. Preserve the local-first invariant: Cloud Run should normally scale to zero when idle (`min-instances=0`) unless an explicit availability requirement justifies otherwise.

Keep these outcomes separate: local verification; image/build success; Cloud Run deploy success; revision readiness; traffic assignment; application smoke test; cost/security review. A successful deployment command does not prove application health.

### State-changing procedures (authorization required)

Deployment, environment changes, scaling changes, traffic changes, service IAM changes, and deletion are state-changing. Use an immutable image/digest or otherwise record the exact source SHA. After an authorized deployment, inspect the new revision, readiness, traffic, logs, health endpoint, authentication, database connectivity, and request errors. Rollback means assigning traffic to a known-good revision; it does not mean deleting the current service.

## Cloud Build

Push-attached triggers can build the same commit repeatedly. A build may run source/buildpack work, push to Artifact Registry, and deploy Cloud Run. Duplicate builds waste build minutes and can create redundant artifacts and revisions.

### Read-only inspection

```bash
gcloud builds triggers list --project <project-id>
gcloud builds triggers describe <trigger-id> --region <region> --project <project-id>
gcloud builds list --project <project-id> --limit=50
gcloud builds describe <build-id> --project <project-id>
```

For each trigger/build, record trigger ID, repository, filter/branch matcher, disabled status, filename, substitutions, source commit SHA, status, duration, and timestamps. Compare build history by exact SHA before a manual retry. Do not infer that a green build is unique or that it deployed the intended revision.

If a trigger is paused with a never-matching branch regex such as `^__paused__never__$`, label that as an **emergency temporary pause**. The preferred durable mechanism is the provider's explicit disabled state when compatible with the trigger configuration. This runbook does not change either form.

### Duplicate-build prevention

Aim for one intended deployment per candidate SHA. Check for a successful or in-progress build before retrying. Distinguish a failed build retry from a duplicate successful deployment; do not repeatedly click Run/retry without understanding prior state. Correlate deployments with Git SHA where possible, require the deployment source SHA to be recorded, avoid production builds for documentation-only commits when possible, and keep automatic triggers narrow and intentional.

## Artifact Registry

Read-only inspection should identify the repository, image names, tags/digests, creation timestamps, and storage growth:

```bash
gcloud artifacts repositories list --project <project-id>
gcloud artifacts docker images list <location>-docker.pkg.dev/<project-id>/<repository> --include-tags
gcloud artifacts docker images describe <image>@<digest> --format='yaml(image_summary,build_details)'
```

Do not delete images as part of inspection. Stale-image deletion and cleanup policies are separate operational changes requiring review, retention decisions, and rollback considerations.

## Secrets

Secrets belong in runtime environment configuration and must never enter Git. This includes `DATABASE_URL`, `JWT_SECRET`, `OTP_HASH_SECRET`, payment/provider credentials, and Cloudinary/Brevo credentials when enabled. The repository's environment examples contain placeholders only.

**FOLLOW_UP:** if live Cloud Run configuration exposes these sensitive values as plain environment values, rotate affected secrets and migrate them to an approved mechanism such as Google Secret Manager. Do not rotate or migrate them through this documentation task, and do not copy current values into reports.

## Cost troubleshooting

1. Start with Billing Reports grouped by Service.
2. Group or filter by SKU.
3. Match the billing period with deployment and build timestamps.
4. Inspect Cloud Build build count and minutes.
5. Inspect Cloud Run requests, instance time, and network egress.
6. Inspect logging volume.
7. Inspect Artifact Registry storage.
8. Inspect unrelated services in the same billing account/project before assigning blame to one component.

Avoid hard-coding quotas or prices; pricing is time-sensitive and should be checked against official provider pricing pages.

## Production incident pause procedure

First classify the intended action:

| Action | Meaning |
| --- | --- |
| Pause deployment | Stop new automatic/manual deployment activity. Existing traffic may continue. |
| Pause traffic | Change routing away from a revision/service; application availability changes. |
| Roll back application | Route traffic to a known-good revision/deployment. |
| Disable service | Change service availability or invocation behavior. |
| Delete resource | Remove a resource and potentially its recoverability. |

These are not equivalent. The previous incident only paused automatic deployment; production services continued serving traffic. Preserve the source SHA, build/trigger ID, revision, account/project/region, timestamps, and observed state. Use the smallest explicitly authorized action, then verify both automation state and serving traffic.

## Gap classification

- **LOCAL:** a documentation correction necessary for this task and inside documentation scope.
- **FOLLOW_UP:** a real operational/configuration mismatch not necessary to produce truthful docs.
- **BLOCKING:** documentation cannot safely state the procedure without missing authority or facts.

Current expected follow-ups are: align GitHub Actions with the `dev` integration model; replace any emergency Cloud Build regex pause with explicit trigger-disabled semantics; migrate sensitive runtime configuration to approved secret management and rotate affected credentials; define Artifact Registry cleanup policy; and investigate build deduplication. None were implemented here.
