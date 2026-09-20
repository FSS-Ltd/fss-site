# Growth OS rollback

What to do when something goes wrong during or after a production promotion
([`docs/runbooks/growth-os-cutover.md`](./growth-os-cutover.md)). Vercel's
immutable deployment history is the application rollback source.

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

1. Promote the last known-good Vercel deployment from Vercel's deployment
   history. If the domain itself is implicated, restore the last known-good
   DNS records captured in Step 2 of the cutover runbook.
2. Re-run the public form and canonical URL smoke checks used during
   cutover Step 4/5 against wherever traffic now lands.
3. Confirm the Gmail OAuth redirect URI, Resend webhook destination, and
   public email asset URLs still resolve correctly after the rollback —
   a domain rollback can silently break exactly these, the same way a
   forward cutover can.

## Operations Studio and portal-routing rollback

For an Operations cutover incident, do not alter staff records, invitations,
or audit evidence. In Vercel Production, make each flag change deliberately
and redeploy after it:

1. Set `OPERATIONS_GROWTH_OPERATIONS_CUTOVER_ENABLED=false` to restore the
   old Growth client and billing workflow routes and endpoints.
2. Set `OPERATIONS_FSS_STUDIO_ENABLED=false` if Studio itself is implicated.
   This also makes the Growth cutover ineffective.
3. Set `OPERATIONS_PORTAL_PREFIX_FREE_ENABLED=false` if portal host routing is
   implicated. Prefix-free portal URLs then redirect to compatible visible
   `/portal/*` destinations.
4. Confirm that the legacy Clerk activation URL remains allow-listed before
   testing an outstanding invitation. Do not remove either activation redirect
   until the agreed rollback window ends.

See [the Operations Studio cutover runbook](./operations-studio-cutover.md)
for the route mapping and post-change smoke checks.

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

Keep the prior Vercel production deployment available for the agreed
observation period after promotion. A suggested minimum is seven clean days
with no incident or rollback trigger. Jean-Fidele sets the actual window at
promotion time and records it in the cutover runbook.

## Incident record

For any rollback actually triggered (not a drill), record in
[`docs/runbooks/growth-os-incident-response.md`](./growth-os-incident-response.md):
trigger, containment actions taken and when, whether a database
restore was needed, recovery validation result, and the post-incident
review outcome.
