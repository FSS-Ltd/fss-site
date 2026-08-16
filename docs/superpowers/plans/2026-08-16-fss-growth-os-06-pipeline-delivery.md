# FSS Growth OS Pipeline And Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carry one prospect record through qualification, deal, client, and delivery views without duplicate organisations, lost audit history, or inconsistent revenue totals.

**Architecture:** A single prospect owns the commercial lifecycle. Explicit state-transition services validate permitted moves and append audit events in the same transaction. Read models project the shared records into Pipeline, Deals, Clients, Delivery, and Analytics pages without copying domain entities.

**Tech Stack:** Next.js App Router, strict TypeScript, Supabase PostgreSQL, Zod, existing dashboard components, Node test runner.

## Global Constraints

- A won prospect becomes a client view of the same business, contact, prospect, and engagement records.
- Do not create a second CRM-style organisation or contact table.
- Store money as integer pence and currency as ISO `GBP` for the MVP.
- Every state change requires founder authorization, current entity version, a permitted transition, and an audit event in one transaction.
- Historical stage events are append-only.
- Revenue analytics come from delivery engagement records, not manual dashboard totals.
- Pipeline values are forecasts until an engagement is won. Do not mix forecast and recognised revenue.
- No invoicing, payments, accounting sync, project management, or client portal is added in this phase.

---

### Task 1: Add Commercial Lifecycle Schema

**Files:**

- Create through CLI: `supabase/migrations/*_growth_pipeline_delivery.sql`
- Create: `tests/integration/growth/pipeline-delivery-schema.test.ts`

**Interfaces:**

- Consumes: businesses, contacts, prospects, audit log
- Produces: `delivery_engagements` and append-only commercial stage events

- [ ] **Step 1: Generate the migration**

```bash
supabase migration new growth_pipeline_delivery
```

- [ ] **Step 2: Write failing schema tests**

Assert the delivery table and stage-event table use UUID primary keys, foreign keys, UTC timestamps, integer money checks, optimistic versions, and indexes from `docs/growth-os/data-api-security.md`. Assert the runtime role cannot update or delete historical stage events.

- [ ] **Step 3: Implement delivery engagement constraints**

Use one optional engagement per prospect. A later opportunity for the same business gets a new historical prospect and engagement instead of rewriting the closed record:

```sql
create unique index unique_engagement_prospect
  on growth.delivery_engagements (prospect_id);

create index delivery_engagements_by_stage
  on growth.delivery_engagements (stage, updated_at desc);

create index won_delivery_engagements
  on growth.delivery_engagements (won_at desc, prospect_id)
  where won_at is not null;
```

Require non-negative one-off and monthly values and a probability from 0 through 100. Require `won_at` and a one-off or monthly value for a won engagement, `lost_at` and loss reason for lost, and neither terminal timestamp for an open stage. A delivery status other than `not_started` requires commercial stage `won`.

- [ ] **Step 4: Add append-only stage events**

Each event stores engagement ID, transition dimension, from state, to state, reason code, actor, correlation ID, and occurred time. Enforce append-only grants. The transition transaction rejects an event whose `from_state` does not match the current commercial stage or delivery status for its dimension.

- [ ] **Step 5: Reset and verify**

```bash
supabase db reset
node --import tsx --test tests/integration/growth/pipeline-delivery-schema.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add -- supabase/migrations tests/integration/growth/pipeline-delivery-schema.test.ts
git commit -m "feat: add pipeline and delivery schema"
```

### Task 2: Implement Commercial And Delivery State Transitions

**Files:**

- Create: `lib/growth/pipeline/stages.ts`
- Create: `lib/growth/pipeline/stages.test.ts`
- Create: `lib/growth/pipeline/transition-engagement.ts`
- Create: `lib/growth/pipeline/transition-engagement.test.ts`
- Create: `lib/growth/pipeline/engagement-repository.ts`

**Interfaces:**

- Consumes: founder action, engagement ID, target state, current version
- Produces: updated engagement and append-only event

- [ ] **Step 1: Write failing transition-table tests**

Define and test the commercial paths separately from delivery:

```text
new -> qualified -> proposal -> negotiation -> won
  \       \           \             \-> lost
   \       \           \-> lost
    \       \-> lost
     \-> lost

after commercial stage won:
not_started -> discovery -> build -> review -> complete -> support
      \            \         \         \-> cancelled
       \            \         \-> cancelled
        \            \-> cancelled
         \-> cancelled
```

Reopening a lost commercial engagement or a complete or cancelled delivery requires a new prospect and engagement, not mutation of the closed record.

- [ ] **Step 2: Define typed commands**

```ts
export type CommercialStage =
  | "new"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export type DeliveryStatus =
  | "not_started"
  | "discovery"
  | "build"
  | "review"
  | "complete"
  | "support"
  | "cancelled";

export type TransitionEngagementInput =
  | {
      dimension: "commercial";
      engagementId: string;
      expectedVersion: number;
      toStage: CommercialStage;
      reasonCode?: string;
      oneOffValuePence?: number;
      monthlyValuePence?: number;
    }
  | {
      dimension: "delivery";
      engagementId: string;
      expectedVersion: number;
      toStatus: DeliveryStatus;
      reasonCode?: string;
    };
```

Add stage-specific Zod refinements so won requires a value, lost requires a reason, and cancelled delivery requires a reason.

- [ ] **Step 3: Implement one transaction boundary**

Lock the engagement row, compare the version, validate the selected dimension, update only its state-specific timestamps and values, insert the stage event, and append the shared audit event. Return a typed conflict when the version changed.

- [ ] **Step 4: Handle outreach side effects explicitly**

Moving the commercial dimension to qualified, proposal, negotiation, won, or lost, or marking the prospect started-talks, stops active automated outreach in the same transaction. Delivery changes have no outreach side effect. A closed sequence cannot be reactivated by a later transition.

- [ ] **Step 5: Run tests**

```bash
node --import tsx --test lib/growth/pipeline/stages.test.ts lib/growth/pipeline/transition-engagement.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add -- lib/growth/pipeline
git commit -m "feat: enforce commercial stage transitions"
```

### Task 3: Build Pipeline Read Models And Board

**Files:**

- Create: `app/(growth)/growth/pipeline/page.tsx`
- Create: `lib/growth/dashboard/pipeline.ts`
- Create: `lib/growth/dashboard/pipeline.test.ts`
- Create: `components/growth/pipeline/pipeline-board.tsx`
- Create: `components/growth/pipeline/pipeline-column.tsx`
- Create: `components/growth/pipeline/pipeline-card.tsx`
- Create: `components/growth/pipeline/stage-transition-form.tsx`
- Create: `components/growth/pipeline/stage-transition-form.test.tsx`

**Interfaces:**

- Consumes: open engagement records and founder transition actions
- Produces: accessible stage board and list alternative

- [ ] **Step 1: Write failing aggregate tests**

Assert per-stage counts and value totals reconcile with board records. Confirm totals exclude won and lost records from the open pipeline regardless of delivery status. Test stable ordering by next action and updated time.

- [ ] **Step 2: Implement a bounded read model**

Return business, primary contact, offer focus, current stage, estimated value, last activity, next action, and version. Return at most the configured page size per stage and a cursor for additional rows.

- [ ] **Step 3: Implement accessible presentation**

Do not rely on drag and drop. Each card has a labelled Move action with only permitted target stages. Provide a semantic list view that contains the same data and actions for keyboard and narrow-screen use.

- [ ] **Step 4: Implement transition confirmation**

Proposal, negotiation, won, and lost transitions show required fields and side effects. Won requires agreed value; lost requires a reason. Every form submits the current version and handles a stale conflict.

- [ ] **Step 5: Run tests**

```bash
node --import tsx --test lib/growth/dashboard/pipeline.test.ts components/growth/pipeline/stage-transition-form.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add -- 'app/(growth)/growth/pipeline/page.tsx' lib/growth/dashboard/pipeline.ts lib/growth/dashboard/pipeline.test.ts components/growth/pipeline
git commit -m "feat: add the commercial pipeline board"
```

### Task 4: Build Deal Detail And Decision History

**Files:**

- Create: `app/(growth)/growth/deals/page.tsx`
- Create: `app/(growth)/growth/deals/[engagementId]/page.tsx`
- Create: `app/(growth)/growth/deals/[engagementId]/not-found.tsx`
- Create: `lib/growth/dashboard/deals.ts`
- Create: `lib/growth/dashboard/deals.test.ts`
- Create: `components/growth/deals/deal-list.tsx`
- Create: `components/growth/deals/commercial-history.tsx`
- Create: `components/growth/deals/deal-actions.test.tsx`

**Interfaces:**

- Consumes: engagement, prospect evidence, correspondence metadata, stage events
- Produces: commercial decision record and current next action

- [ ] **Step 1: Write failing read-model tests**

Cover an open deal, won deal, lost deal, missing deal, multiple opportunities for one business, and event ordering. Assert reply bodies and provider tokens never enter the view model.

- [ ] **Step 2: Implement the list**

Support stage, value band, owner, and next-action filters. Show estimated and agreed value as distinct fields. Do not label forecast value as revenue.

- [ ] **Step 3: Implement detail sections**

Show current commercial position, contact and business, problem evidence, proposed scope, email/thread link, next action, loss reason, and append-only commercial history. Delivery cancellation belongs to the client view.

- [ ] **Step 4: Add founder actions**

Reuse the transition service and form components. Add only action-note creation required to set a dated next step. Do not introduce a generic notes system.

- [ ] **Step 5: Run tests**

```bash
node --import tsx --test lib/growth/dashboard/deals.test.ts components/growth/deals/deal-actions.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add -- 'app/(growth)/growth/deals' lib/growth/dashboard/deals.ts lib/growth/dashboard/deals.test.ts components/growth/deals
git commit -m "feat: add deal decision views"
```

### Task 5: Build Client And Delivery Views

**Files:**

- Create: `app/(growth)/growth/clients/page.tsx`
- Create: `app/(growth)/growth/clients/[businessId]/page.tsx`
- Create: `lib/growth/dashboard/clients.ts`
- Create: `lib/growth/dashboard/clients.test.ts`
- Create: `components/growth/clients/client-list.tsx`
- Create: `components/growth/clients/client-detail.tsx`
- Create: `components/growth/clients/delivery-status.tsx`
- Create: `components/growth/clients/delivery-status.test.tsx`
- Create: `components/growth/clients/client-thank-you-review.tsx`
- Create: `components/growth/clients/client-thank-you-review.test.tsx`
- Create: `app/(growth)/growth/clients/[businessId]/messages/[messageId]/page.tsx`
- Create: `app/api/growth/client-messages/[messageId]/approve-send/route.ts`
- Create: `lib/growth/clients/client-thank-you.ts`
- Create: `lib/growth/clients/client-thank-you.test.ts`

**Interfaces:**

- Consumes: businesses with won engagement records
- Produces: client portfolio and delivery status without duplicate client rows

- [ ] **Step 1: Write failing identity tests**

Assert one business appears once in the client list even when it has multiple won engagements. Assert all engagements remain visible on detail and that corporate identity comes from the shared business record.

- [ ] **Step 2: Implement client read models**

List primary contact, active engagement count, latest delivery stage, agreed lifetime value, last activity, and next action. Detail shows each opportunity independently with its own stage history and value.

- [ ] **Step 3: Implement delivery transitions**

Allow delivery status to move from not started through discovery, build, review, complete, and optional support only after the engagement is won. Permit cancellation from the documented in-progress states, require a reason, and keep commercial and delivery histories visible as separate timelines.

- [ ] **Step 4: Queue the client thank-you for review**

The first transition to `complete` creates one idempotent `client-delivery-thank-you` Resend message snapshot from the Plan 04 template. It remains `pending_approval`; the transition does not call Resend. Include the optional newsletter invitation only when the client is not subscribed and the founder chooses to include it. Creating or sending this message never creates newsletter consent.

- [ ] **Step 5: Add founder review and send**

Reuse the safe email preview pattern from Plan 05. The founder can remove the invitation block, send a test to the founder address, or approve the exact snapshot for the client. The server route repeats founder authorization, suppression, version, recipient, and template checks before calling the Resend adapter. Set `newsletter_invited_at` only after a successful send that contained the opt-in invitation.

- [ ] **Step 6: Render empty and completed states**

When no client has been won, explain that clients appear automatically after a won transition. Completed clients remain discoverable through a filter and are not deleted.

- [ ] **Step 7: Run tests**

```bash
node --import tsx --test lib/growth/dashboard/clients.test.ts lib/growth/clients/client-thank-you.test.ts components/growth/clients/delivery-status.test.tsx components/growth/clients/client-thank-you-review.test.tsx
```

- [ ] **Step 8: Commit**

```bash
git add -- 'app/(growth)/growth/clients' app/api/growth/client-messages lib/growth/dashboard/clients.ts lib/growth/dashboard/clients.test.ts lib/growth/clients components/growth/clients
git commit -m "feat: add client delivery views"
```

### Task 6: Define And Build Commercial Analytics

**Files:**

- Create: `lib/growth/analytics/definitions.ts`
- Create: `lib/growth/analytics/definitions.test.ts`
- Create: `lib/growth/dashboard/analytics.ts`
- Create: `lib/growth/dashboard/analytics.test.ts`
- Create: `app/(growth)/growth/analytics/page.tsx`
- Create: `components/growth/analytics/analytics-page.tsx`
- Create: `components/growth/analytics/funnel-summary.tsx`
- Create: `components/growth/analytics/revenue-summary.tsx`
- Create: `components/growth/analytics/sequence-summary.tsx`
- Create: `components/growth/analytics/analytics-page.test.tsx`

**Interfaces:**

- Consumes: stage events, engagements, outreach metadata, calendar window
- Produces: documented funnel, pipeline, won-value, and delivery metrics

- [ ] **Step 1: Write metric definitions before SQL**

Define numerator, denominator, inclusion time, timezone, and empty-denominator behaviour for:

- researched prospects
- approved first emails
- replies
- qualified opportunities
- proposals
- wins
- open pipeline value
- agreed won value
- completed delivery value
- reply, meeting, proposal, and win conversion rates

Do not call agreed value recognised revenue until an accounting definition exists.

- [ ] **Step 2: Write failing metric tests with a fixed dataset**

Include events that cross month boundaries, duplicate provider events, one business with two opportunities, a lost opportunity, a cancelled delivery, and a zero-denominator window.

- [ ] **Step 3: Implement bounded aggregate queries**

Filter by explicit UTC range derived from a London calendar range. Reconcile pipeline totals to open engagement rows and won totals to won events. Return raw counts beside percentages for auditability.

- [ ] **Step 4: Build the analytics page**

Use compact summary cards and accessible data tables. Add charts only when the relationship is clearer than a table and provide an equivalent text summary. Do not add a chart dependency unless the existing stack cannot produce an accessible minimal visual.

- [ ] **Step 5: Run tests**

```bash
node --import tsx --test lib/growth/analytics/definitions.test.ts lib/growth/dashboard/analytics.test.ts components/growth/analytics/analytics-page.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add -- lib/growth/analytics lib/growth/dashboard/analytics.ts lib/growth/dashboard/analytics.test.ts 'app/(growth)/growth/analytics/page.tsx' components/growth/analytics
git commit -m "feat: add documented Growth OS analytics"
```

### Task 7: Verify The Complete Commercial Lifecycle

**Files:**

- Create: `tests/integration/growth/commercial-lifecycle.test.ts`
- Create: `docs/runbooks/pipeline-delivery.md`
- Update: `README.md`

- [ ] **Step 1: Add a lifecycle integration test**

Exercise one prospect through commercial stages new, qualified, proposal, negotiation, and won, then delivery statuses discovery, build, review, and complete. Assert:

- one business and contact identity remain
- one engagement changes state
- one event exists for every transition
- active outreach stops at qualification
- pipeline totals drop at won
- client view appears at won
- delivery view changes without duplicate client records
- completion creates one reviewable client thank-you without creating consent
- analytics reconcile at each stage

- [ ] **Step 2: Add negative lifecycle tests**

Cover stale version, invalid commercial jump, delivery before won, missing won value, missing loss reason, missing cancellation reason, reopening a terminal engagement, duplicate engagement for one prospect, and concurrent transitions.

- [ ] **Step 3: Add the operator runbook**

Document stage definitions, when to create a new opportunity, correcting a mistaken transition through an explicit forward repair, pipeline-total reconciliation, and the boundary between agreed value and recognised accounting revenue.

- [ ] **Step 4: Run the full checks**

```bash
supabase db reset
node --import tsx --test tests/integration/growth/commercial-lifecycle.test.ts
pnpm test
pnpm test:redesign
pnpm lint
pnpm build
```

- [ ] **Step 5: Inspect every changed file and the final diff**

Confirm identity is not duplicated, state transitions are centralised, events are append-only, money units are consistent, pages remain thin, and no accounting claim exceeds the recorded data.

- [ ] **Step 6: Commit**

```bash
git add -- tests/integration/growth/commercial-lifecycle.test.ts docs/runbooks/pipeline-delivery.md README.md
git commit -m "docs: add pipeline and delivery operations"
```

## Plan 06 Exit Gate

- [ ] One business identity survives the full prospect-to-client lifecycle.
- [ ] All state transitions are validated, versioned, transactional, and audited.
- [ ] Open pipeline, won value, and delivery value are defined and kept distinct.
- [ ] Won work appears in client and delivery views without duplication.
- [ ] Terminal records cannot be silently reopened or erased.
- [ ] Analytics reconcile to underlying records and event history.
- [ ] Full project checks pass before review.
