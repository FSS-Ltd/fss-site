# Growth OS production cutover

The explicit gate between a reviewed Vercel preview and real production
traffic. Nothing in this runbook may be executed until Step 1's approval
is recorded. This document does not itself authorise anything — it
records what must be true, and in what order, before it happens.

## Step 1: Stop and request explicit founder approval

Present to Jean-Fidele, together, before touching anything:

- The reviewed preview URL and Vercel deployment ID.
- The exact commit SHA that will be promoted.
- The completed
  [`docs/runbooks/growth-os-preview-checklist.md`](./growth-os-preview-checklist.md)
  results (automated and manual).
- The reviewed `supabase db diff --linked` migration diff.
- Provider readiness: Gmail dedicated client, Resend domain
  verification, webhook registration, all confirmed per
  [`docs/runbooks/growth-os-provider-setup.md`](./growth-os-provider-setup.md).
- The planned DNS/domain change, and its rollback method.
- The expected interruption window, if any.

**Do not proceed past this point without Jean-Fidele's explicit
approval of both the production deployment and the domain cutover.**
Approval of the deployment alone does not imply approval of the domain
change — record them as two separate confirmations if they don't happen
in the same moment.

Record here:

- Approved by:
- Date/time:
- Deployment approved: yes/no
- Domain cutover approved: yes/no

## Step 2: Capture the existing recoverable state

Before making any change, record (values only, never secrets):

- Active Netlify deployment URL and deployment ID.
- Current DNS records and their TTL, for every domain/subdomain
  involved.
- Current Vercel production deployment (if any prior one exists).
- Current Supabase migration version (`supabase migration list
  --linked`, or the latest applied version from
  `supabase_migrations.schema_migrations`).
- Database backup status/timestamp.
- Current automation state (`GROWTH_OS_AUTOMATIONS_ENABLED` value, which
  should already be `false`).

## Step 3: Apply reviewed database migrations

1. Take or verify a fresh backup.
2. Re-run `supabase db diff --linked` — confirm it matches exactly what
   was reviewed at preview time. If it doesn't, stop and re-review; do
   not push a diff that wasn't the one approved.
3. Run `pnpm verify:migrations` one more time against the final
   migration set.
4. Apply only the reviewed forward migrations (`supabase db push`).
   **Never** a destructive down-migration or `supabase db reset` — see
   the Global Constraints in the release plan.
5. Verify schema, grants, and the runtime role (`growth_app`) after
   applying — confirm no browser-facing role (`anon`, `authenticated`)
   picked up unexpected access.

## Step 4: Promote the reviewed commit to Vercel production

1. Promote the **exact** commit that was previewed and approved — not a
   newer one, even if it looks like a trivial follow-up.
2. Confirm `GROWTH_OS_AUTOMATIONS_ENABLED=false` in the Production
   environment before promoting.
3. Before changing the domain, smoke-check the Vercel production URL
   directly (its own `*.vercel.app` URL, not the custom domain yet):
   - Public site loads.
   - Founder sign-in works and rejects any other account.
   - `pnpm verify:growth-release` (run locally, pointed at production
     env vars) or `/growth/settings` reports database and provider
     health as expected.
   - Public forms submit successfully.
   - One provider test-recipient check succeeds (Resend transactional
     test), same as the preview checklist's manual steps.

## Step 5: Move the domain

1. Apply the pre-reviewed DNS or Vercel domain change.
2. Verify TLS issuance completes on the new domain.
3. Verify canonical redirects (bare domain → `www`, or vice versa,
   whichever this project's convention is) still work.
4. Verify `NEXT_PUBLIC_SITE_URL` in Production matches the live domain —
   `resolveSiteUrl()` (`lib/config/site-url.ts`) falls back to a
   hardcoded production domain when unset, so a mismatch here produces
   plausible-looking but wrong links (unsubscribe links, email asset
   URLs) rather than an obvious error.
5. Verify form callback URLs, the Gmail OAuth redirect URI, the Resend
   webhook destination, and public email asset URLs all resolve on the
   new domain.

## Step 6: Observe with automations disabled

Watch logs and provider consoles (Vercel function logs, Resend activity
log, Google Cloud Console) for at least one full period of every cron
schedule (worst case: 24 hours, to cover the once-daily maintenance
cron) with automations still disabled. Confirm:

- No unexpected sends.
- No repeated/looping calls to any provider.
- Every cron route consistently reports `{ ok: true, skipped:
  "automations_disabled" }`.
- Netlify remains available and completely unchanged throughout.

## Step 7: Enable automation in two gates

Each gate is a deliberate configuration change followed by an immediate
smoke check — never both gates in the same change.

**Gate 1 — Gmail:**

1. Set `GROWTH_OS_AUTOMATIONS_ENABLED=true` only once Gmail and cron
   configuration are fully complete (`lib/growth/config/env.ts` already
   refuses to boot with automations enabled in production unless Gmail,
   Resend, and `CRON_SECRET` are all configured — this is a second,
   independent confirmation, not a substitute for reviewing it here).
2. Enroll one founder-owned test sequence.
3. Verify the outreach-dispatch cron sends it, the thread appears
   correctly in the test Gmail account, and a reply correctly stops the
   sequence (`gmail-sync` cron).

**Gate 2 — Resend and Codex ingestion (only after Gate 1 is clean):**

1. Confirm the Resend webhook is registered and its secret matches
   production's `RESEND_WEBHOOK_SECRET`.
2. Send one newsletter test through `/growth/newsletter`'s send-test
   action to a founder-controlled address.
3. Confirm the `resend-dispatch` cron picks up and sends a real queued
   issue correctly (or that none is queued yet, if that's the case).
4. Only then verify the external Codex research task's production
   `GROWTH_OS_AGENT_HMAC_SECRET` and target URL, and enable its weekday
   schedule. Do not enable it before this point — a misconfigured secret
   or URL here fails closed (research ingestion rejects with `401`), but
   there is no reason to find that out before Gate 1 is proven safe.

## Step 8: Record production evidence

- Deployment ID:
- Commit SHA:
- Migration version after Step 3:
- DNS completion time:
- Gate 1 (Gmail) enable time and smoke result:
- Gate 2 (Resend + Codex) enable time and smoke result:
- Any deviation from this runbook, and why:

If anything in Steps 4 through 7 fails or looks wrong, stop and follow
[`docs/runbooks/growth-os-rollback.md`](./growth-os-rollback.md)
immediately rather than trying to push forward.
