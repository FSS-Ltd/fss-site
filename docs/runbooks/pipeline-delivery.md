# Pipeline and delivery runbook

Operating notes for the Growth OS commercial lifecycle: one prospect's
opportunity, from qualification through a won deal to a delivered and
supported client. This is the founder's own reference, not end-user
documentation.

## Stage definitions

A prospect's commercial opportunity is tracked on its own
`growth.delivery_engagements` row, separate from `growth.prospects.status`
(the earlier research/outreach lifecycle). An engagement moves through two
independent dimensions, each with its own transition table
(`lib/growth/pipeline/stages.ts`):

**Commercial stage** (`stage`): `new -> qualified -> proposal -> negotiation
-> won`, with `lost` reachable from any open stage. `won` and `lost` are
dead ends — see "When to create a new opportunity" below.

**Delivery status** (`delivery_status`): `not_started -> discovery -> build
-> review -> complete -> support`, with `cancelled` reachable from any
in-progress state (`not_started` through `review`). `support` and
`cancelled` are dead ends; `complete` is the one state that can still move
forward, to `support`. Delivery can only advance once the commercial stage
is `won` (`delivery_engagement_delivery_requires_won`, enforced at both the
app layer and the schema).

Both dimensions are enforced identically: a database trigger
(`reject_terminal_commercial_stage_change` /
`reject_terminal_delivery_status_regression`) rejects the illegal move even
if something bypasses the application layer, and every transition is
made through one function, `transitionEngagement`
(`lib/growth/pipeline/transition-engagement.ts`), which locks the row,
checks the caller's version against the current one, validates the move
against the transition table, and — in the same transaction — appends one
row to `growth.commercial_stage_events` and one to `growth.audit_log`.
There is no other path that changes `stage` or `delivery_status`.

## Making a transition

Founders move an engagement from the Pipeline board (`/growth/pipeline`),
the Deal detail page (`/growth/deals/[engagementId]`), or the Client detail
page (`/growth/clients/[businessId]`) — all three call the same route,
`POST /api/growth/engagements/[id]/transition`
(`app/api/growth/engagements/[id]/transition/route.ts`), which wraps
`transitionEngagement`. There is no separate "create an engagement" UI or
route yet: today, the first `growth.delivery_engagements` row for a
prospect is inserted directly (`stage` defaults to `new`), which is the
correct point for a founder or operator to attach the offer name and
initial estimated value.

A repeated call with the *same* target stage/status is treated as already
applied (`alreadyApplied: true` in the response) rather than an error —
this is what makes a page that just refreshed, or a retried request, safe
to resubmit.

## When to create a new opportunity

`unique_engagement_prospect` allows at most one `delivery_engagements` row
per prospect, and `lost`/`won` never reopen. If a business that was
previously lost (or a client whose engagement is now in `support`) comes
back with a new opportunity, **do not try to reopen the old engagement or
its prospect**. Create a new, separate `growth.prospects` row for the same
business (reusing the existing `growth.businesses` and `growth.contacts`
rows — never duplicate identity) and a new `delivery_engagements` row
against that new prospect. The old prospect and engagement stay exactly as
they were: a true, unedited record of what actually happened the first
time. A business can have several historical prospects and engagements;
the client and deal views already handle this (`getClientDetail` lists
every won engagement for a business independently, and the client list
groups by business without collapsing history).

## Correcting a mistaken transition

There is no "undo" and no way to edit a stored `commercial_stage_events`
row (the runtime role only has `select, insert` on it — see the schema
grants in `supabase/migrations/20260822090000_growth_pipeline_delivery.sql`).
If a transition was a genuine mistake (the wrong target stage, a typo'd
reason), the only correct fix is an **explicit forward repair**: make a
new transition that moves the engagement to where it actually should be,
with a `reasonCode` that says so plainly (for example,
`"correction: previous move to negotiation was a mistake, reverting to proposal is not possible - recording the correct current stage"`).
Because `won` and `lost` are dead ends, a stage wrongly marked `won` or
`lost` cannot be repaired this way — if that happens, treat it as data
correction outside the transition system: a manual, audited database
update, recorded the same way the resend-marketing runbook records manual
suppression overrides (`docs/runbooks/resend-marketing.md`), never a
silent edit. This is intentionally rare and manual: the append-only event
log is only trustworthy if every entry is something that was genuinely
true when it was recorded.

## Pipeline-total reconciliation

"Open pipeline value" always means the same thing everywhere it appears —
the sum of `one_off_value_pence + monthly_value_pence` across
`delivery_engagements` rows whose `stage` is one of `new`, `qualified`,
`proposal`, `negotiation` (`OPEN_PIPELINE_STAGES` in
`lib/growth/dashboard/pipeline.ts`). The analytics module
(`lib/growth/dashboard/analytics.ts`) builds its own "open pipeline value"
metric from that same constant rather than a second hardcoded stage list,
specifically so the number on `/growth/analytics` and the total on
`/growth/pipeline` can never drift apart. If they ever disagree, that is a
bug — one of the two stopped importing `OPEN_PIPELINE_STAGES` and hardcoded
its own list instead.

"Wins" and "completed delivery value" are event-sourced, not read from the
mutable `stage`/`delivery_status` columns: they count distinct engagements
with a `commercial_stage_events` row whose `to_state` is `won` (dimension
`commercial`) or `complete` (dimension `delivery`) inside the reporting
window. A `delivery_engagements` row that was ever hand-edited to
`stage = 'won'` outside `transitionEngagement` (which should not happen in
normal operation, but can during a manual data fix) will show up in
`agreedWonValuePence` (a snapshot sum) without showing up in the `wins`
funnel count (an event count) — that mismatch is the system correctly
telling you a value exists without a recorded event explaining how it got
there. Investigate rather than "fixing" the mismatch by adjusting a number.

## Agreed value vs. recognised revenue

`one_off_value_pence` and `monthly_value_pence` on a won engagement are the
figure the founder agreed with the client — nothing more. Nothing in this
codebase performs revenue recognition (accrual timing, refunds,
part-payment, VAT treatment, deferred delivery value). Every label in the
product and in this runbook says "agreed value" or "won value", never
"revenue", and that distinction is deliberate: do not report an agreed
value to an accountant, investor, or tax return as recognised revenue
without first defining, separately, how and when this business recognises
revenue. Until that definition exists, treat every won/agreed figure in
Growth OS as a commercial fact (what was promised), not an accounting fact
(what has been earned).

## Client delivery thank-you

The first time an engagement's delivery status reaches `complete`,
`transitionEngagement` creates exactly one `growth.client_messages` row in
the same transaction (idempotent — a repeated `complete` transition, or a
`complete -> support -> complete` cycle, never creates a second one; see
`unique_client_message_engagement`). It starts, and stays, `pending_approval`
until a founder reviews it at
`/growth/clients/[businessId]/messages/[messageId]` and either sends a test
to themselves or approves and sends it — the transition itself never calls
Resend. Whether the message includes the optional FSS Field Notes
invitation is decided once, at creation (the founder's choice at the moment
of completing delivery, cross-checked against the client's current
newsletter-subscription status), and can only be *narrowed* afterwards —
the review page can remove an included invitation before sending, but can
never add one that was not there originally. **Sending this message never
creates newsletter consent by itself**; `newsletter_invited_at` is set only
after a successful send that actually contained the invitation, and a
client only becomes a subscriber if they separately complete the on-site
opt-in.

## Analytics

`/growth/analytics` reports one London calendar month at a time
(`lib/growth/analytics/definitions.ts` documents every metric's numerator,
denominator, and inclusion timestamp before any SQL was written against
it). Two things worth knowing when reading it:

- A rate (reply, meeting, proposal, win) reports "Not enough data" rather
  than `0%` when its denominator is zero for the selected month — a quiet
  month is not the same as a month where everything failed to convert.
- Every count and sum is a *raw, traceable* figure — the module deliberately
  returns counts alongside percentages so a number can always be checked
  against the underlying rows, not just trusted.

## Verifying the full lifecycle

`tests/integration/growth/commercial-lifecycle.test.ts` drives one real
prospect through the entire lifecycle above against a real Postgres
database (`DIRECT_DATABASE_URL`) — every commercial and delivery stage, the
outreach-stop side effect, the pipeline/client/analytics views, the
client-thank-you creation, and a set of negative cases (stale version,
invalid jumps, missing required fields, reopening a terminal engagement, a
duplicate engagement, and two genuinely concurrent conflicting
transitions). Run it with:

```bash
pnpm test:integration:growth
```

It skips itself (rather than failing) when `DIRECT_DATABASE_URL` is not
set, matching every other integration test in this repository.
