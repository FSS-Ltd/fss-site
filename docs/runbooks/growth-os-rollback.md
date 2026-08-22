# Growth OS rollback

What to do when something goes wrong during or after cutover
([`docs/runbooks/growth-os-cutover.md`](./growth-os-cutover.md)). Netlify
stays available and unchanged through the entire agreed rollback window
specifically so this runbook always has somewhere safe to return to.

## Rollback triggers

Stop and start containment immediately on any of:

- Wrong-account access (a session, OAuth token, or database connection
  using the wrong Google/Supabase/Vercel account).
- Any suspected secret exposure.
- An uncontrolled send (email sent that wasn't an approved test, or sent
  to a non-test recipient).
- A duplicate send (the same message sent more than once).
- Migration corruption (a migration applied incorrectly, or against the
  wrong schema/role).
- Form data loss (a public form submission not persisted or
  misdirected).
- A provider replay loop (a webhook or cron retrying without bound).
- Persistent `5xx` responses on any Growth OS route.
- Domain or TLS failure after the Step 5 domain cutover.

## Immediate containment

In this order:

1. Set `GROWTH_OS_AUTOMATIONS_ENABLED=false` in the Vercel Production
   environment and redeploy (or apply instantly if the platform supports
   it). Every cron route (`lib/growth/http/cron-auth.ts`'s shared guard)
   starts no-opping on its very next scheduled invocation — no code
   change or cron detachment required. This is always the first action,
   regardless of which trigger fired.
2. Pause all active sequences and newsletters in one action — the
   founder dashboard's **Pause all active sequences**
   (`/growth/settings`, `lib/growth/settings/pause-automations.ts`)
   pauses every currently active outreach sequence through the same
   `stopSequence(reason: "pause")` path used for pausing one sequence
   individually. It does not touch `GROWTH_OS_AUTOMATIONS_ENABLED`
   itself (that's a Vercel environment variable, not a database row) —
   do Step 1 regardless of whether this dashboard action is reachable.
3. If send safety is uncertain (wrong-account access, or the Gmail
   connection itself may be compromised): revoke the Gmail automation
   connection from `/growth/settings`'s Disconnect action.
4. Disable the Resend webhook or sender only if containment specifically
   requires it — this is more disruptive than the previous three steps
   (it also stops legitimate delivery-event tracking), so only take it
   if the incident is Resend-specific.
5. Preserve logs and audit evidence — do not truncate, rotate, or delete
   `growth.audit_log` or provider console logs while an incident is
   still being investigated.

## Application and domain rollback

1. Promote the last known-good Vercel deployment (Vercel's own
   deployment history), or, if the domain itself is implicated, return
   DNS to the values recorded in Step 2 of the cutover runbook
   (Netlify's production deployment).
2. Re-run the public form and canonical URL smoke checks used during
   cutover Step 4/5 against wherever traffic now lands.
3. Confirm the Gmail OAuth redirect URI, Resend webhook destination, and
   public email asset URLs still resolve correctly after the rollback —
   a domain rollback can silently break exactly these, the same way a
   forward cutover can.

## Database recovery

**Prefer a forward repair migration** in every case that isn't confirmed
destructive corruption. A forward migration is reviewable, testable with
`pnpm verify:migrations`, and keeps the audit trail intact.

Restore from backup **only** for confirmed destructive corruption, and
only after an explicit incident decision (not a unilateral action mid-
investigation). Never use:

- `supabase db reset`
- A destructive down-migration
- Manual table deletion in production

These are excluded even during an active incident — a backup restore
plus a forward repair migration is safer than an improvised destructive
statement under pressure.

## Rollback window

Keep the Netlify configuration, GitHub workflow
(`.github/workflows/netlify-deploy.yml`), site, and access available and
completely unchanged for at least the agreed observation period after
cutover. A suggested minimum is seven clean days (no incident, no
rollback triggered); Jean-Fidele sets the actual window at cutover time
(recorded in `docs/runbooks/growth-os-cutover.md`'s Step 1).

Do not make any change to Netlify's configuration during this window,
even an apparently unrelated one — it must stay a reliable fallback, not
a second thing that could have drifted.

## Netlify retirement (separate pull request, later)

Once the rollback window has passed cleanly and Jean-Fidele explicitly
approves retirement:

1. Open a **separate** pull request — never combined with the
   production cutover commit or with any other Growth OS release work.
2. Remove obsolete Netlify deployment automation and configuration
   (`.github/workflows/netlify-deploy.yml`, `netlify.toml`, and any
   Netlify-specific scripts).
3. Update canonical hosting documentation to reflect Vercel as the sole
   host.
4. Confirm Vercel's own deployment history and rollback tooling are
   sufficient on their own before removing the Netlify fallback for
   good — this is the last check, not a formality.

## Incident record

For any rollback actually triggered (not a drill), record in
[`docs/runbooks/growth-os-incident-response.md`](./growth-os-incident-response.md):
trigger, containment actions taken and when, whether a database
restore was needed, recovery validation result, and the post-incident
review outcome.
