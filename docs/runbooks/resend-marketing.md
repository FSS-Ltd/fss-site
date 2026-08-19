# Resend marketing runbook

Operating notes for the Growth OS marketing slice: requested-resource
transactional email and founder-run newsletter issues, both sent through
Resend. This is the founder's own reference, not end-user documentation.

## What this system does and does not do

Resend is used only for:

- Transactional replies to a site enquiry or a requested resource
  (`emails/site-enquiry-thank-you.tsx`, `emails/resource-delivery.tsx`,
  `emails/client-delivery-thank-you.tsx`).
- Newsletter issues sent to subscribers who gave explicit, evidenced
  opt-in consent (`growth.newsletter_subscribers`, status `subscribed`).

It never sends cold outreach. `ResendMessage.category` in
`lib/growth/integrations/resend/client.ts` is a closed allowlist —
`site-enquiry`, `resource-delivery`, `client-delivery-thank-you`,
`newsletter-welcome`, `newsletter` — with no cold/prospect category in it.
Any code path that tried to send a cold message through the Resend gateway
would be rejected with `ResendClientError("REJECTED_CATEGORY")` before a
request ever reaches Resend's API. Cold prospect outreach in this codebase
goes through Gmail (`lib/growth/integrations/gmail`), a separate adapter,
never Resend.

## Domain and sender setup

1. In the Resend dashboard, add and verify the sending domain (SPF, DKIM,
   and DMARC records at the DNS provider). Do not send until the domain
   shows verified — unverified sends land in spam or get rejected.
2. Set `RESEND_FROM_EMAIL` to a verified address on that domain.
3. Set `RESEND_REPLY_TO_EMAIL` to the founder's own Workspace address
   (`j.ntagengwa@faithfulsoftware.dev`). Every send in this codebase sets
   `replyTo` explicitly — there is no path that omits it — so all replies
   land in the founder's inbox, never a noreply address.
4. Generate a Resend API key scoped to sending only and set
   `RESEND_API_KEY`.

## Webhook registration

1. In the Resend dashboard, add a webhook endpoint pointing at
   `POST /api/webhooks/resend` (`app/api/webhooks/resend/route.ts`) on the
   deployed origin.
2. Subscribe it to at least: `email.sent`, `email.delivered`,
   `email.bounced`, `email.complained`. (`email.delivery_delayed`,
   `email.opened`, `email.clicked` are also recognised and safe to include.)
3. Copy the endpoint's signing secret into `RESEND_WEBHOOK_SECRET`. Resend
   signs webhook deliveries with Svix; the route reads the `svix-id`,
   `svix-timestamp`, and `svix-signature` headers and verifies them against
   this secret (`verifyResendWebhookSignature` in
   `lib/growth/integrations/resend/webhook.ts`) before touching the payload.
   A missing secret or a bad signature returns `401` without leaking which
   check failed.
4. A payload with a `type` this codebase doesn't parse still returns `200`
   deliberately — Resend retries on any non-2xx response, and retrying a
   payload the parser will never accept just produces a retry storm.

## Test-recipient policy

- `sendFounderTest` (`lib/growth/newsletter/issues.ts`) is the only way to
  send a newsletter issue to a single address before it goes to the full
  list. It always sends to `founderEmail` — the founder's own address —
  never to a subscriber, and it does not touch any subscriber's state.
- Use it before every `approveIssue` / `scheduleIssue`. `scheduleIssue`
  refuses to run (`test_not_sent`) unless the current snapshot version has
  already been test-sent.
- There is no arbitrary "send a test to this other address" path. If a
  second reviewer needs to see a draft, forward the founder's test send.

## Replay handling

Every Resend webhook delivery is idempotent by design, keyed on the Svix
`svix-id` as `provider_event_id` in `growth.resend_delivery_events`
(`hasDeliveryEvent` / `recordDeliveryEvent` in
`lib/growth/integrations/resend/webhook-repository.ts`). A replayed
delivery (Resend retry, or manual re-delivery from the dashboard) is
detected before any suppression/audit side effect runs, and the handler
returns `{ status: "applied", duplicate: true }` without re-inserting a
suppression row or re-cancelling already-cancelled sends. Out-of-order
delivery is safe for the same reason: each event is applied at most once,
independent of arrival order, because suppression writes are themselves
upserts (`on conflict ... do nothing` / `do update`).

To investigate a specific delivery, query
`growth.resend_delivery_events` by `provider_event_id` (the `svix-id`
header) or `recipient_normalised_email`.

## Suppression recovery

`growth.suppressions` and `growth.newsletter_subscribers.status` move an
address to `bounced` or `complained` automatically on a permanent bounce
or a spam complaint (`applySuppression` in
`lib/growth/integrations/resend/webhook.ts`). This is deliberately
one-directional today: **there is no public "clear a suppression" path**
in this codebase. `recordNewsletterOptIn` explicitly refuses to
resubscribe an address in `bounced` or `complained` status
(`NewsletterConsentError("already_suppressed")`).

If a founder confirms an address was wrongly suppressed (for example, a
transient provider-side classification error, or the subscriber fixed
their inbox), the only way to restore it today is a manual, audited
database update:

```sql
update growth.newsletter_subscribers
set status = 'subscribed', unsubscribed_at = null, updated_at = now()
where normalised_email = '<address>';

delete from growth.suppressions
where normalised_email = '<address>';
```

Do this deliberately and rarely — a bounce or complaint is usually a
correct signal. There is no in-app tooling for this in the current plan;
building one is out of scope here.

## Disabling the dispatcher

Set `GROWTH_OS_AUTOMATIONS_ENABLED=false` to stop all cron-driven sending.
`createCronRouteHandler` (`lib/growth/http/cron-auth.ts`), used by both
`app/api/cron/resend-dispatch/route.ts` and
`app/api/cron/outreach-dispatch/route.ts`, checks this flag before running
anything — a disabled dispatcher never seeds new sends or claims queued
ones, and it does so without needing to touch the cron schedule itself.
Newsletter issues already `scheduled` simply wait; nothing is lost, and
flipping the flag back to `true` resumes dispatch on the next run.

The cron endpoint also requires `CRON_SECRET` on every inbound request
(checked by the same handler) so the dispatch route cannot be triggered by
an unauthenticated request even while automations are enabled.

## Prohibition on cold outreach through Resend

This bears repeating because it is a hard constraint of the whole plan,
not a suggestion: Resend must never send unsolicited cold outreach. A site
enquiry or a requested-resource download does not create newsletter
consent — only an explicit opt-in
(`recordNewsletterOptIn` in `lib/growth/newsletter/subscribers.ts`) does,
and every newsletter dispatch re-checks `status = 'subscribed'` at both
seed time and claim time. The `ResendMessage.category` allowlist in
`lib/growth/integrations/resend/client.ts` has no cold-outreach category,
so even a bug that tried to route cold prospect data through this adapter
would be rejected by the client itself before any request reached Resend.
