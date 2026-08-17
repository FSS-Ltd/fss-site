# FSS Growth OS Vercel Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release the completed Growth OS on Vercel Pro through a verified preview, explicit founder approval, reversible domain cutover, and disabled-by-default automation rollout while keeping Netlify available for rollback.

**Architecture:** GitHub remains the deployment source. Vercel builds previews for reviewed changes and hosts the Next.js application and protected cron routes. Supabase remains the database, Vercel Blob stores approved email visuals, and provider secrets exist only in scoped Vercel environments. Netlify production stays active until a separately approved domain change.

**Tech Stack:** Vercel Pro, Next.js 16, Vercel Functions and Cron Jobs, Vercel Blob, Supabase PostgreSQL, GitHub Actions, Netlify rollback deployment.

## Global Constraints

- This plan does not authorise a production deployment, DNS change, Supabase production migration, OAuth consent publication, or provider credential creation by itself.
- Jean-Fidele must explicitly approve the production cutover after reviewing the Vercel preview.
- Keep the existing Netlify deployment, workflow, site, and configuration intact through the rollback window.
- `GROWTH_OS_AUTOMATIONS_ENABLED` is `false` in preview and at initial production promotion.
- Cron routes, webhook routes, and ingestion routes fail closed when their secrets are missing.
- Secrets are never copied into Markdown, pull requests, build output, screenshots, client bundles, or logs.
- Preview uses test recipients and isolated or clearly tagged test data. It cannot send cold outreach to a real prospect.
- Database changes move forward through reviewed migrations. Do not use destructive schema rollback after production data exists.
- The scheduled Codex research task remains external to Vercel and uses no paid GPT API in the MVP.
- Retiring Netlify is a separate pull request after the agreed rollback window.

---

### Task 1: Add A Release Configuration Contract

**Files:**

- Create: `lib/growth/config/release-env.ts`
- Create: `lib/growth/config/release-env.test.ts`
- Update: `.env.example`
- Create: `docs/runbooks/growth-os-environment-matrix.md`

**Interfaces:**

- Consumes: server environment variables
- Produces: validated, redacted runtime configuration

- [ ] **Step 1: Write failing environment tests**

Cover local, preview, and production. Assert server boot fails for malformed URLs, a non-founder owner email, weak secrets, invalid base64 encryption material, or a production automation flag without all provider configuration.

- [ ] **Step 2: Define environment groups**

Document these server-only names without values:

```text
DATABASE_URL
DIRECT_DATABASE_URL
AUTH_SECRET
AUTH_GOOGLE_ID
AUTH_GOOGLE_SECRET
GROWTH_OS_OWNER_EMAIL
GROWTH_OS_AGENT_HMAC_SECRET
GROWTH_OS_AUTOMATIONS_ENABLED
TOKEN_ENCRYPTION_KEY
GOOGLE_GMAIL_CLIENT_ID
GOOGLE_GMAIL_CLIENT_SECRET
GOOGLE_GMAIL_REDIRECT_URI
CRON_SECRET
RESEND_API_KEY
RESEND_WEBHOOK_SECRET
RESEND_FROM_EMAIL
RESEND_REPLY_TO_EMAIL
NEWSLETTER_UNSUBSCRIBE_SECRET
BLOB_READ_WRITE_TOKEN
```

Keep only canonical site URL, analytics ID, and other deliberately public values under `NEXT_PUBLIC_*`.

- [ ] **Step 3: Implement one validated server boundary**

Expose typed groups for database, auth, Gmail, Resend, agent ingestion, cron, and Blob. Export only safe redacted health information to dashboard read models.

- [ ] **Step 4: Define the environment matrix**

For each name record owner, local source, Vercel Preview scope, Vercel Production scope, rotation procedure, and whether changing it requires an application restart. Use placeholders such as `<set in Vercel>` only.

- [ ] **Step 5: Run tests**

```bash
node --import tsx --test lib/growth/config/release-env.test.ts
pnpm exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add -- lib/growth/config/release-env.ts lib/growth/config/release-env.test.ts .env.example docs/runbooks/growth-os-environment-matrix.md
git commit -m "security: define Growth OS release configuration"
```

### Task 2: Add Vercel Function And Cron Configuration

**Files:**

- Update: `vercel.json`
- Update: `lib/growth/http/cron-auth.ts`
- Update: `lib/growth/http/cron-auth.test.ts`
- Create: `app/api/cron/maintenance/route.ts`
- Create: `app/api/cron/maintenance/route.test.ts`
- Create: `docs/runbooks/growth-os-cron.md`

**Interfaces:**

- Consumes: Vercel cron requests and `CRON_SECRET`
- Produces: authenticated bounded dispatch and maintenance invocations

- [ ] **Step 1: Write failing cron authorization tests**

Cover correct bearer value, missing authorization, wrong scheme, wrong secret, empty configured secret, automation disabled, and timing-safe comparison.

- [ ] **Step 2: Implement the shared guard**

Every cron route continues to call the shared guard created in Plan 03 before domain work. Extend its tests for every final route. The guard returns a generic 401 without exposing whether the route or secret exists. When automation is disabled, return a successful no-op with a redacted status.

- [ ] **Step 3: Configure schedules in UTC**

Use Vercel Cron only for provider reconciliation and dispatch. The scheduled Codex research task is not duplicated here.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/cron/gmail-sync", "schedule": "*/10 * * * *" },
    { "path": "/api/cron/outreach-dispatch", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/resend-dispatch", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/maintenance", "schedule": "17 3 * * *" }
  ]
}
```

Do not attach cron to a page route. Keep each handler on the Node.js runtime and within a documented batch and duration limit.

- [ ] **Step 4: Implement bounded maintenance**

Maintenance expires abandoned leases, reports stale integrations, and removes expired transient OAuth state. It does not delete audit events, suppressions, email history, or business records.

- [ ] **Step 5: Add the cron runbook**

Document schedules as UTC, expected frequency, batch limits, lock behaviour, manual invocation in a safe environment, disabled response, alert thresholds, and emergency shutdown.

- [ ] **Step 6: Run tests and validate JSON**

```bash
node --import tsx --test lib/growth/http/cron-auth.test.ts app/api/cron/maintenance/route.test.ts
node -e 'JSON.parse(require("node:fs").readFileSync("vercel.json", "utf8"))'
```

- [ ] **Step 7: Commit**

```bash
git add -- vercel.json lib/growth/http/cron-auth.ts lib/growth/http/cron-auth.test.ts app/api/cron/maintenance docs/runbooks/growth-os-cron.md
git commit -m "feat: configure protected Vercel cron jobs"
```

### Task 3: Add Release Health And Readiness Checks

**Files:**

- Create: `lib/growth/health/checks.ts`
- Create: `lib/growth/health/checks.test.ts`
- Create: `app/api/growth/health/route.ts`
- Create: `app/api/growth/health/route.test.ts`
- Create: `scripts/verify-growth-release.ts`
- Update: `package.json`

**Interfaces:**

- Consumes: founder session or local CLI context
- Produces: safe readiness report and non-zero verification exit

- [ ] **Step 1: Write failing health tests**

Cover healthy database, migration mismatch, Gmail disconnected, Resend misconfigured, Blob missing, Codex run stale, cron stale, and automation disabled. Assert secrets, database host, recipient addresses, and provider response bodies are never included.

- [ ] **Step 2: Implement layered health states**

Separate:

- application health: process can serve safely
- dependency readiness: required providers are configured
- automation readiness: all send and sync preconditions are met

The application can be healthy while automation readiness is disabled.

- [ ] **Step 3: Protect the health route**

Require the founder session and return the same redacted model used by dashboard settings. Do not create a public dependency probe.

- [ ] **Step 4: Implement a CLI verification script**

Add `pnpm verify:growth-release`. The script checks configuration presence, migration status, template checksums, automation flag, and expected application URL. It performs no send and makes no state-changing provider call.

- [ ] **Step 5: Run tests**

```bash
node --import tsx --test lib/growth/health/checks.test.ts app/api/growth/health/route.test.ts
pnpm verify:growth-release
```

The local verification is expected to report missing production-only integrations without printing their values. The command should support an explicit `--allow-unconfigured` mode for local development only.

- [ ] **Step 6: Commit**

```bash
git add -- lib/growth/health app/api/growth/health scripts/verify-growth-release.ts package.json
git commit -m "feat: add Growth OS release readiness checks"
```

### Task 4: Strengthen CI For The Growth OS

**Files:**

- Update: `.github/workflows/ci.yml`
- Create: `scripts/verify-migrations.ts`
- Create: `scripts/verify-migrations.test.ts`
- Update: `package.json`

**Interfaces:**

- Consumes: pull-request source tree
- Produces: lint, type, unit, integration-contract, build, and migration-order gates

- [ ] **Step 1: Capture migration-order failures in tests**

Test duplicate migration timestamps, non-SQL files, disallowed destructive statements, missing private schema qualification, and migrations that grant the browser-facing roles direct Growth OS access.

- [ ] **Step 2: Add deterministic package scripts**

Add scripts for type checking, all Node tests, and migration policy validation. Keep provider integration tests on fake gateways in ordinary CI. Do not require production secrets for a pull request.

- [ ] **Step 3: Update the existing CI workflow**

Run in this order:

1. frozen install
2. migration policy check
3. type check
4. unit and service integration tests
5. existing redesign validation
6. lint
7. production build
8. existing homepage bundle budget

Set dummy-but-valid build-time secrets only where server module validation requires them. Never make them usable provider credentials.

- [ ] **Step 4: Preserve Netlify deployment CI**

Do not edit or disable `.github/workflows/netlify-deploy.yml` in this task. Netlify continues to deploy `main` until the separate retirement pull request.

- [ ] **Step 5: Run the same commands locally**

```bash
pnpm verify:migrations
pnpm typecheck
pnpm test
pnpm test:redesign
pnpm lint
pnpm build
pnpm perf:budget:homepage
```

- [ ] **Step 6: Commit**

```bash
git add -- .github/workflows/ci.yml scripts/verify-migrations.ts scripts/verify-migrations.test.ts package.json
git commit -m "ci: gate Growth OS release quality"
```

### Task 5: Prepare External Service Setup Without Activating Production

**Files:**

- Create: `docs/runbooks/growth-os-provider-setup.md`
- Create: `docs/runbooks/growth-os-secrets-rotation.md`
- Update: `docs/runbooks/growth-os-environment-matrix.md`

- [ ] **Step 1: Document Supabase linking and migration flow**

Use the founder-provided project reference:

```bash
supabase --version
supabase login
supabase init
supabase link --project-ref gfeyanrriryihpcgdvqi
supabase db diff --linked
supabase migration list --linked
```

`supabase db push` requires explicit approval after the migration diff is reviewed and backed up. Runtime `DATABASE_URL` uses the transaction pooler. `DIRECT_DATABASE_URL` is limited to migration and maintenance tooling.

- [ ] **Step 2: Document separate Google OAuth clients**

Create one client for Auth.js dashboard sign-in and a separate client for Gmail automation. Record exact redirect URIs for local, preview, and production. Limit dashboard sign-in to the founder account. Request Gmail offline access only from the explicit founder connection flow.

- [ ] **Step 3: Document Resend setup**

Verify the sending subdomain, configure SPF/DKIM as directed by Resend, set the Workspace reply-to, register the signed webhook, and use founder-controlled test recipients. State again that Resend cannot send cold outreach.

- [ ] **Step 4: Document Vercel Blob and project setup**

Link the GitHub repository to the existing Vercel Pro account, keep the framework preset as Next.js, create a private Blob store that produces stable public email-asset URLs, and scope tokens by environment.

- [ ] **Step 5: Document secret generation and rotation**

Generate independent high-entropy values for Auth, cron, ingestion HMAC, unsubscribe HMAC, and token encryption. Record where each is set and how to rotate it. Do not include the values in the document.

- [ ] **Step 6: Review the runbooks before any external mutation**

Require a human check for account ownership, billing scope, redirect domains, sending domain, project reference, and rollback access.

- [ ] **Step 7: Commit**

```bash
git add -- docs/runbooks/growth-os-provider-setup.md docs/runbooks/growth-os-secrets-rotation.md docs/runbooks/growth-os-environment-matrix.md
git commit -m "docs: add Growth OS provider setup"
```

### Task 6: Create And Verify A Vercel Preview

**Files:**

- Create: `docs/runbooks/growth-os-preview-checklist.md`
- Create: `tests/integration/growth/preview-contract.test.ts`

- [ ] **Step 1: Establish preview data boundaries**

Use an isolated Supabase branch or a clearly separate preview schema/database. If the free plan cannot provide isolation, keep all automations disabled, use founder-owned test addresses only, prefix test records, and provide an explicit cleanup migration or script. Never point an unreviewed preview at active production outreach data.

- [ ] **Step 2: Configure Preview-scoped Vercel variables**

Set preview URLs, OAuth redirect, database, provider test credentials, and `GROWTH_OS_AUTOMATIONS_ENABLED=false`. Confirm no Production-scoped secret is exposed to Preview unless deliberately shared and documented.

- [ ] **Step 3: Open the implementation release pull request**

Allow the linked Vercel project to create a preview deployment from the reviewed branch. Do not use `vercel --prod`.

- [ ] **Step 4: Run preview contract tests**

Against the preview URL verify:

- public pages and current forms preserve behaviour
- founder sign-in accepts only the founder
- database health and migration version are correct
- signed ingestion accepts a fixture and rejects a replay or bad signature
- one Gmail draft or sandbox send uses the founder-controlled test mailbox
- one Resend transactional test and one newsletter test reach approved test recipients
- webhook replays are idempotent
- automation routes report disabled
- static assets and email images use HTTPS and return expected cache headers

Use HTTP-level scripts and provider consoles. Do not introduce browser automation.

- [ ] **Step 5: Run quality and security review**

Confirm no secret in client JavaScript, HTML, source maps, logs, or build output. Verify auth cookies, security headers, route runtimes, CSP, CORS absence where unnecessary, and origin checks on founder actions.

- [ ] **Step 6: Obtain founder visual sign-off**

Jean-Fidele compares the preview manually with `docs/growth-os/mockups/` and records approval or requested changes. This is required before production promotion.

- [ ] **Step 7: Commit the completed checklist evidence**

Record dates, deployment ID, commit SHA, pass/fail results, and safe provider message IDs. Do not include access tokens or recipient content.

```bash
git add -- docs/runbooks/growth-os-preview-checklist.md tests/integration/growth/preview-contract.test.ts
git commit -m "test: verify the Growth OS preview"
```

### Task 7: Run The Explicit Production Cutover Gate

**Files:**

- Create: `docs/runbooks/growth-os-cutover.md`
- Create: `docs/runbooks/growth-os-rollback.md`

- [ ] **Step 1: Stop and request explicit founder approval**

Provide the reviewed preview URL, commit SHA, checklist results, migration diff, provider readiness, DNS change, rollback method, and expected interruption. Do not continue until Jean-Fidele explicitly approves production deployment and domain cutover.

- [ ] **Step 2: Capture the existing recoverable state**

Record the active Netlify deployment URL and ID, current DNS values and TTL, current Vercel production deployment, Supabase migration version, database backup status, and automation state. Do not store secret values.

- [ ] **Step 3: Apply reviewed database migrations**

After approval, take or verify the backup, re-run linked migration diff, and apply only the reviewed forward migrations. Verify schema, grants, and runtime role before application promotion.

- [ ] **Step 4: Promote the reviewed commit to Vercel production**

Use the exact previewed commit. Keep `GROWTH_OS_AUTOMATIONS_ENABLED=false`. Run public-site, founder-auth, database, forms, and provider test-recipient smoke checks on the Vercel production URL before changing the domain.

- [ ] **Step 5: Move the domain**

Apply the pre-reviewed DNS or Vercel domain change. Verify TLS, canonical redirects, metadata URL, form callbacks, OAuth redirect, webhook destinations, and public email asset URLs.

- [ ] **Step 6: Observe with automations disabled**

Confirm logs and provider consoles show no unexpected sends or repeated calls. Netlify remains available and unchanged.

- [ ] **Step 7: Enable automation in two gates**

1. Enable Gmail sync and dispatch for founder-owned test sequences, then verify thread and stop behaviour.
2. Enable Resend dispatch and the weekday signed Codex ingestion after the first gate is clean.

Each gate requires a deliberate configuration change and immediate smoke check. Do not enable an external research task until its production HMAC secret and target URL are verified.

- [ ] **Step 8: Record production evidence**

Record deployment ID, commit, migration version, DNS completion time, automation enable times, smoke results, and any deviations in the cutover runbook.

### Task 8: Exercise Rollback And Retire Netlify Separately

**Files:**

- Update: `docs/runbooks/growth-os-rollback.md`
- Create later in a separate PR: Netlify retirement changes

- [ ] **Step 1: Define rollback triggers**

Rollback for wrong-account access, secret exposure, uncontrolled send, duplicate send, migration corruption, form data loss, provider replay loop, persistent 5xx, or domain/TLS failure.

- [ ] **Step 2: Define immediate containment**

1. Set `GROWTH_OS_AUTOMATIONS_ENABLED=false`.
2. Pause all active sequences and newsletters in one transaction.
3. Revoke the Gmail automation connection if send safety is uncertain.
4. Disable the Resend webhook or sender only if containment requires it.
5. Preserve logs and audit evidence.

- [ ] **Step 3: Define application and domain rollback**

Promote the last known-good Vercel deployment or return DNS to the recorded Netlify production deployment. Re-run the public form and canonical URL smoke checks.

- [ ] **Step 4: Define database recovery**

Prefer forward repair migrations. Restore from backup only for confirmed destructive corruption and after an incident decision. Do not use `supabase db reset`, destructive down migrations, or manual table deletion in production.

- [ ] **Step 5: Hold the rollback window**

Keep Netlify configuration, GitHub workflow, site, and access available for at least the agreed observation period. A suggested minimum is seven clean days, but Jean-Fidele sets the final window at cutover.

- [ ] **Step 6: Open a separate Netlify retirement pull request**

Only after founder approval, remove obsolete Netlify deployment automation and configuration, update canonical hosting documentation, and confirm Vercel rollback history is sufficient. Do not combine this with the production cutover commit.

### Task 9: Complete Release Verification And Handoff

**Files:**

- Update: `README.md`
- Update: `docs/runbooks/growth-os-cutover.md`
- Update: `docs/runbooks/growth-os-rollback.md`
- Create: `docs/runbooks/growth-os-incident-response.md`
- Update: project context document referenced by repository instructions

- [ ] **Step 1: Run the final local checks on the released commit**

```bash
pnpm verify:migrations
pnpm typecheck
pnpm test
pnpm test:redesign
pnpm lint
pnpm build
pnpm perf:budget:homepage
```

- [ ] **Step 2: Confirm production operational checks**

Verify public site, forms, founder access, database, Gmail sync, Gmail controlled send, Resend controlled send, signed webhooks, signed agent ingestion, cron freshness, Blob assets, suppression, audit trail, and all dashboard health states.

- [ ] **Step 3: Add the incident runbook**

Document severity, immediate containment, provider revocation, sequence pause, secret rotation, database evidence preservation, communication owner, recovery validation, and post-incident review.

- [ ] **Step 4: Update setup and architecture documentation**

Document Vercel as the active host only after cutover. Preserve the Netlify rollback note until the retirement pull request merges. Record the no-paid-AI MVP constraint and GBP 5,000 MRR review threshold.

- [ ] **Step 5: Perform a senior diff and operations review**

Confirm checks are green, provider and tenant boundaries hold, no secret or personal data leaked, automations are bounded and observable, rollback is usable, and documentation matches the deployed commit.

- [ ] **Step 6: Commit the final handoff**

```bash
git add -- README.md docs/runbooks project-context-path
git commit -m "docs: complete Growth OS release handoff"
```

Replace `project-context-path` with the actual context document required by the repository instructions. Do not stage unrelated vault or workspace changes.

## Plan 07 Exit Gate

- [ ] The reviewed commit passes CI and all local checks.
- [ ] Vercel preview passes functional, security, provider, and manual visual review.
- [ ] Founder explicitly approves production promotion and domain cutover.
- [ ] Production begins with automation disabled and enables each channel through a controlled gate.
- [ ] Netlify remains recoverable throughout the agreed rollback window.
- [ ] Rollback and incident procedures are current and usable.
- [ ] Netlify retirement is deferred to a separate approved pull request.
