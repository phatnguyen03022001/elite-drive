# Branch Workflow

## Operating model

Elite Drive uses a two-branch authority model:

- `dev` is the integration branch for normal mutation and candidate validation.
- `main` is the stable branch and production authority.

The current checkout is on `main`, but ordinary work should follow the `dev` integration model.

## Normal development flow

1. Start from the intended `dev` base and confirm the working tree is understood.
2. Make the change locally on `dev` (or on a short-lived branch based on `dev` when review requires one).
3. Verify locally before consuming shared CI:

   Frontend:

   ```bash
   cd client
   npm ci
   npm run lint
   npm run typecheck
   npm run build
   ```

   Backend:

   ```bash
   cd server
   npm install
   npx prisma generate
   npm run build
   ```

   In `server/package.json`, `npm run build` invokes `prebuild` first. That runs typecheck, CI tests, and the production dependency-audit report, followed by `nest build`.
4. Review the diff and generated files. Documentation-only changes should not trigger production work or unnecessarily consume CI.
5. Commit the verified change with a clear message. Push only the intended branch and exact candidate SHA.
6. Use shared/remote CI as additional evidence when applicable. Do not repeatedly dispatch or retry Actions while debugging a problem reproducible locally.
7. Obtain required review or Architect acceptance, capture the exact accepted candidate SHA, and promote explicitly from `dev` to `main`.
8. Deployment is a separate explicit action. After deployment, verify revision readiness, traffic, application behavior, security, and cost.

## Exact-SHA awareness

Record the candidate SHA before promotion and compare it with the local commit, remote branch tip, CI status, and deployed revision/image source. A green check on a different SHA is not evidence for the candidate. A provider accepting a commit is not evidence that the application is healthy.

Before promotion, refresh both branches and stop if the expected base or candidate changed. Do not create an extra post-review commit unless it is the single explicitly allowed review-artifact child and is re-verified under the governing review process.

## Remote movement and divergence

If the remote branch moved after local inspection:

- fetch or inspect the remote state without overwriting local work;
- identify which commits moved and whether the candidate SHA is still the intended lineage;
- stop and request re-review when the candidate, base, or accepted diff is no longer exact;
- resolve ordinary divergence only when the owner and review authority explicitly permit it, then re-run local verification and record the new SHA.

Do not automatically merge, rebase, force-push, or rewrite history to make branches line up. No force-push or history rewrite is allowed by default. Stop rather than resolving automatically when authority, target branch, source SHA, review acceptance, or the consequence of the merge is unclear.

## GitHub Actions policy

Local shell verification is the primary development loop. Actions are remote/shared verification: useful for an accepted candidate, but not the default debugging loop. Prefer bounded workflows with relevant path filters, standard runners, concurrency cancellation for superseded runs, and read-only repository permissions.

Avoid unnecessary matrices, duplicate workflows, artifacts, caches, large runners, manual dispatch, automatic retries, or paid external services without evidence that they solve a real problem. A documentation-only change should not consume CI when path filters can avoid it.

The current repository workflows still target `main` for push and pull-request events. Therefore the desired branch governance and current GitHub Actions triggers are not yet aligned. **FOLLOW_UP:** define and review a bounded `dev` integration workflow; do not treat the current `main` filters as proof that `dev` CI exists. The workflows were not changed by this documentation task.

CI success, code review, Architect acceptance, promotion authorization, deployment success, and runtime health are separate signals. A successful Action never authorizes promotion or deployment by itself.

## Commit, push, and promotion rules

- Commit only the intended files after reviewing `git diff` and a secret-oriented diff.
- Push only the named branch and intended SHA; do not push `main` or promote it without explicit authorization.
- Never use `git push --force` or rewrite shared history by default.
- Promotion is an explicit, reviewable `dev -> main` operation, not an automatic consequence of CI or deployment.
- If `main` or `dev` moved, refresh state and re-verify exact lineage before any promotion decision.

## Emergency and recovery rules

First identify the operation: pause automatic deployment, pause traffic, roll back the application, disable a service, and delete a resource are different actions. Use the smallest authorized action that limits harm. Record the affected SHA, revision, trigger, account, project, region, and observed state. Preserve evidence, avoid repeated retries, and verify the resulting state.

If a deployment system is misbehaving, pausing its automation does not necessarily stop a currently serving production service. Follow the platform runbook for provider-specific distinctions and require explicit authorization before changing provider state.
