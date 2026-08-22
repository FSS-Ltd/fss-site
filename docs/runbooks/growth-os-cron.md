# Growth OS cron runbook

Operating notes for the four Vercel Cron jobs that drive Growth OS
automation (`vercel.json`). This is the founder's own reference, not
end-user documentation.

## Shared guard

Every cron route (`app/api/cron/*/route.ts`) is built with
`createCronRouteHandler` (`lib/growth/http/cron-auth.ts`), which runs
before any domain work:

1. Requires an `Authorization: Bearer <CRON_SECRET>` header matching
   `CRON_SECRET` via a timing-safe comparison. Missing header, wrong
   scheme, wrong secret, or an unconfigured `CRON_SECRET` on the server
   all return a generic `401` with no indication of which check failed.
2. If `GROWTH_OS_AUTOMATIONS_ENABLED` is `false`, returns
   `{ ok: true, skipped: "automations_disabled" }` with a `200` and does
   no domain work at all — including for `maintenance`, which is
   otherwise read-only.
3. Only past both checks does the route's own work function run. Any
   thrown error becomes a generic `500` with no error detail in the
   response body; the real error goes to `reportUnexpectedError` (server
   logs only, never the client).

Vercel Cron sends the configured `CRON_SECRET` automatically once a cron
job is attached to the project — there is nothing to wire up beyond
setting the environment variable.

## Schedules (UTC)

| Path | Schedule | Frequency | What it does |
| --- | --- | --- | --- |
| `/api/cron/gmail-sync` | `*/10 * * * *` | Every 10 minutes | Syncs Gmail replies into `growth.email_messages`, stops sequences on inbound reply. |
| `/api/cron/outreach-dispatch` | `*/5 * * * *` | Every 5 minutes | Runs Gmail sync, then claims and sends due outreach messages one batch at a time. |
| `/api/cron/resend-dispatch` | `*/5 * * * *` | Every 5 minutes | Claims and sends due newsletter issue sends through Resend. |
| `/api/cron/maintenance` | `17 3 * * *` | Once daily, 03:17 UTC | Builds and logs a redacted integration health report (Gmail, Resend, database, automation state). No off-peak scheduling reason beyond avoiding the top of the hour. |

None of these are attached to a page route — each is its own
`app/api/cron/<name>/route.ts` on `export const runtime = "nodejs"`, so
Vercel Cron invokes it directly.

## Batch and duration limits

- `outreach-dispatch` and `resend-dispatch` each claim and process **one**
  due message per invocation (`claimDueMessage` / the newsletter
  equivalent uses `for update ... skip locked limit 1`). A backlog drains
  over successive 5-minute runs rather than in one long-running request.
- `gmail-sync` processes whatever Gmail returns for the configured
  history window in a single call; it does not paginate across multiple
  invocations.
- `maintenance` performs no batching — it is a single read of the
  integration connections table plus environment/automation state, always
  bounded and fast.

## Lease behaviour (why there is no separate lease-expiry job)

`email_messages` and newsletter sends use an optimistic `lease_token` /
`lease_expires_at` pair. Both dispatch routes' claim queries already
reclaim any row stuck in `sending` past its lease expiry as part of their
normal `where` clause (`status = 'sending' and lease_expires_at < now()`),
atomically, on every run. A stuck lease is therefore bounded to at most
one dispatch cycle (5 minutes) without any dedicated cleanup step — adding
one would duplicate that logic. `maintenance` does not touch leases.

## OAuth state (why there is no separate state-cleanup job)

The Gmail OAuth `state` value is stored in an httpOnly cookie
(`GMAIL_OAUTH_STATE_COOKIE`, `lib/growth/integrations/gmail-oauth-route-handler.ts`)
with a 10-minute `maxAge`, never in the database. It expires itself; there
is nothing for `maintenance` to remove.

## Manual invocation (safe environments only)

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "$SITE_URL/api/cron/maintenance"
```

Only run this against a preview or local deployment with a test
`CRON_SECRET` you control. Never run a manual invocation against
production outside the cutover/rollback runbooks — `outreach-dispatch` and
`resend-dispatch` will send real email if automations are enabled.

## Disabled response

Every route returns the same shape when `GROWTH_OS_AUTOMATIONS_ENABLED` is
`false`:

```json
{ "ok": true, "skipped": "automations_disabled" }
```

with HTTP `200` and `cache-control: no-store`. This is the expected
response for all four crons throughout preview and at initial production
promotion (`GROWTH_OS_AUTOMATIONS_ENABLED=false` — see the release plan's
Global Constraints).

## Alert thresholds

- `outreach-dispatch` or `resend-dispatch` returning a non-`200` on three
  consecutive scheduled runs: investigate before the next run — a stuck
  lease will otherwise recur every cycle.
- `maintenance`'s report showing `gmail` or `resend` at `attention` or
  `disconnected` for more than one day: reconnect the provider from
  `/growth/settings`.
- Any cron returning `401`: `CRON_SECRET` is missing or wrong in the
  Vercel project environment — check before assuming an attack.

## Emergency shutdown

Set `GROWTH_OS_AUTOMATIONS_ENABLED=false` in the Vercel project
environment and redeploy (or use Vercel's instant environment-variable
apply if available). Every cron route immediately starts no-opping on its
very next scheduled invocation — no code change or cron detachment
required. See `docs/runbooks/growth-os-rollback.md` for the full
containment procedure.
