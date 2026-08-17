# FSS Growth OS Resend Marketing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist public enquiries and newsletter consent in PostgreSQL, then send complete requested and opted-in FSS marketing emails through Resend without allowing a cold prospect into the Resend path.

**Architecture:** Existing public routes become PostgreSQL-first boundaries. Domain services create immutable render snapshots and idempotent email outbox records. A Resend adapter sends only allowlisted transactional or consented marketing categories, and signed webhooks reconcile delivery and suppression state.

**Tech Stack:** Next.js Route Handlers, Supabase PostgreSQL, Resend, React Email, Zod, Node test runner.

## Global Constraints

- Resend must never send unsolicited cold outreach.
- A site enquiry or requested resource does not create newsletter consent.
- Newsletter sending requires an active, evidenced opt-in at dispatch time.
- Every template provides complete HTML and plain text, meaningful image alt text, and `Reply-To: j.ntagengwa@faithfulsoftware.dev`.
- Newsletter images are editorial assets. They cannot fabricate staff, premises, clients, testimonials, reviews, or measured results.
- Public forms keep their current route paths and response contracts.
- PostgreSQL is the source of truth. HubSpot becomes a non-blocking downstream sync only if the existing integration remains enabled.
- Provider calls stay behind a typed adapter. Templates and routes never import the Resend SDK directly.

---

### Task 1: Add Site Lead, Consent, Newsletter, And Resend Event Schema

**Files:**

- Create through CLI: `supabase/migrations/*_growth_resend_marketing.sql`
- Create: `tests/integration/growth/resend-marketing-schema.test.ts`

**Interfaces:**

- Consumes: foundation schema and shared email tables
- Produces: `inbound_leads`, `newsletter_subscribers`, `newsletter_issues`, Resend template rows, delivery indexes

- [ ] **Step 1: Generate the migration**

```bash
supabase migration new growth_resend_marketing
```

- [ ] **Step 2: Write a failing schema test**

Assert the tables, checks, foreign keys, partial indexes, and runtime grants described in `docs/growth-os/data-api-security.md`. Assert a subscriber cannot be `subscribed` without `consented_at`, `consent_source`, and `consent_evidence`.

- [ ] **Step 3: Implement schema constraints**

Include at minimum:

```sql
create unique index unique_inbound_submission
  on growth.inbound_leads (submission_id);

create unique index unique_newsletter_email
  on growth.newsletter_subscribers (normalised_email);

create index subscribed_newsletter_recipients
  on growth.newsletter_subscribers (normalised_email)
  where status = 'subscribed';

create unique index unique_newsletter_issue_key
  on growth.newsletter_issues (issue_key, version);

create unique index unique_channel_provider_message
  on growth.email_messages (channel, provider_message_id)
  where provider_message_id is not null;
```

Add triggers that reject newsletter issue edits after scheduling and reject reactivation without new consent evidence. Store consent and unsubscribe timestamps separately.

- [ ] **Step 4: Seed versioned Resend templates**

Seed definitions for:

- `site-enquiry-thank-you`
- `resource-delivery`
- `client-delivery-thank-you`
- `newsletter-welcome`
- `newsletter-issue`

Record template version `1.0`, category, required merge fields, asset policy, status, and checksum. Do not place provider IDs or secrets in seed data.

- [ ] **Step 5: Reset and verify**

```bash
supabase db reset
node --import tsx --test tests/integration/growth/resend-marketing-schema.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add -- supabase/migrations tests/integration/growth/resend-marketing-schema.test.ts
git commit -m "feat: add Resend marketing schema"
```

### Task 2: Build The Shared FSS Email Layout

**Files:**

- Create: `emails/components/fss-email-layout.tsx`
- Create: `emails/components/email-image.tsx`
- Create: `emails/styles.ts`
- Create: `emails/render-email.ts`
- Create: `emails/render-email.test.tsx`

**Interfaces:**

- Consumes: typed template props and an approved public asset URL
- Produces: deterministic HTML and plain text render snapshots

- [ ] **Step 1: Install only the required email packages**

```bash
pnpm add resend @react-email/components @react-email/render
```

- [ ] **Step 2: Write failing layout tests**

Assert:

- the FSS wordmark and preheader are present
- layout width is no greater than 640 pixels
- images have non-empty alt text and explicit dimensions
- text remains understandable when images are omitted
- a Workspace reply address and company identity are visible
- marketing categories include an unsubscribe placeholder
- transactional categories explain why the person received the email
- no tracking pixel, remote font, script, form, video, or fabricated social proof is rendered
- plain text contains the same offer, call to action, and compliance footer as HTML

- [ ] **Step 3: Implement focused shared components**

```ts
export type FssEmailCategory =
  | "transactional"
  | "resource-delivery"
  | "newsletter";

export type FssEmailLayoutProps = {
  category: FssEmailCategory;
  previewText: string;
  title: string;
  children: React.ReactNode;
  image?: {
    src: string;
    alt: string;
    width: number;
    height: number;
  };
  unsubscribeUrl?: string;
};
```

Keep styles inline and email-client-safe. Use system fonts and reusable spacing and colour tokens from `emails/styles.ts`.

- [ ] **Step 4: Implement one rendering boundary**

`renderEmail()` accepts an allowlisted template key and validated props, renders HTML with React Email, renders plain text, validates parity, and returns a checksum. It must not send.

- [ ] **Step 5: Run tests and type checking**

```bash
node --import tsx --test emails/render-email.test.tsx
pnpm exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add -- package.json pnpm-lock.yaml emails
git commit -m "feat: add shared FSS email renderer"
```

### Task 3: Implement Complete Requested-Email Templates

**Files:**

- Create: `emails/site-enquiry-thank-you.tsx`
- Create: `emails/resource-delivery.tsx`
- Create: `emails/client-delivery-thank-you.tsx`
- Create: `emails/requested-emails.test.tsx`
- Update: `lib/server/lead-email-templates.ts`
- Update: `lib/server/intake-email-template.ts`

**Interfaces:**

- Consumes: validated name, business name, request or delivery context, and approved editorial asset
- Produces: complete site acknowledgement, resource delivery, and client thank-you snapshots

- [ ] **Step 1: Write failing content tests**

Use the approved copy and content rules in `docs/growth-os/email-content-and-image-standard.md`. Test realistic names containing apostrophes and non-ASCII characters. Assert missing optional business name does not create broken copy.

- [ ] **Step 2: Implement the site enquiry acknowledgement**

The email must confirm receipt, set a realistic response expectation, explain how FSS works, provide a direct reply path, and use the approved thank-you visual. It must not add a newsletter unsubscribe link or imply newsletter membership.

- [ ] **Step 3: Implement resource delivery**

The email must identify the requested resource, provide one prominent download action and a raw fallback URL, explain the next practical step, and state why it was sent.

- [ ] **Step 4: Implement the client delivery thank-you**

Render the approved copy in the email standard. Include the newsletter invitation only when the recipient is not already subscribed, the founder has approved the first MVP send, and a valid opt-in URL exists. The invitation links to a separate consent action and never writes consent by opening or clicking the email. If ineligible, render the complete thank-you without the invitation block.

- [ ] **Step 5: Convert existing template entry points into adapters**

Preserve the public exports consumed by `lib/server/lead-submission.ts` and `lib/server/intake-submission.ts`, but delegate rendering to the new typed templates. Remove duplicated markup created by this change.

- [ ] **Step 6: Run focused regression tests**

```bash
node --import tsx --test emails/requested-emails.test.tsx lib/intake/schema.test.ts
pnpm exec tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add -- emails lib/server/lead-email-templates.ts lib/server/intake-email-template.ts
git commit -m "feat: add complete requested email templates"
```

### Task 4: Implement Complete Newsletter Templates

**Files:**

- Create: `emails/newsletter-welcome.tsx`
- Create: `emails/newsletter-issue.tsx`
- Create: `emails/newsletter-emails.test.tsx`
- Create: `lib/growth/newsletter/content.ts`
- Create: `lib/growth/newsletter/content.test.ts`

**Interfaces:**

- Consumes: active subscriber and approved issue snapshot
- Produces: newsletter welcome and issue HTML/plain-text snapshots

- [ ] **Step 1: Write failing template tests**

Cover subject and preheader length, complete body sections, one primary call to action, postal identity, reason for receipt, unsubscribe link, plain-text parity, and safe image metadata.

- [ ] **Step 2: Implement the newsletter welcome**

Use the full welcome copy in the email standard. Confirm what the reader will receive, set frequency expectations, and include an immediate unsubscribe path.

- [ ] **Step 3: Implement the issue template**

Model content as explicit typed sections instead of free-form HTML:

```ts
export type NewsletterSection =
  | { type: "position"; heading: string; body: string[] }
  | { type: "practice"; heading: string; steps: string[] }
  | { type: "case-note"; heading: string; body: string[] }
  | { type: "cta"; label: string; href: string };
```

Sanitise and validate URLs at the boundary. Do not accept arbitrary HTML or scripts from the dashboard.

- [ ] **Step 4: Add brand-content validation**

Reject empty sections, more than one primary call to action, missing image attribution metadata, banned claims, a missing unsubscribe token, or an issue without a plain-text rendering.

- [ ] **Step 5: Run tests**

```bash
node --import tsx --test emails/newsletter-emails.test.tsx lib/growth/newsletter/content.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add -- emails/newsletter-welcome.tsx emails/newsletter-issue.tsx emails/newsletter-emails.test.tsx lib/growth/newsletter
git commit -m "feat: add complete newsletter templates"
```

### Task 5: Add A Typed Resend Provider Adapter

**Files:**

- Create: `lib/growth/integrations/resend/client.ts`
- Create: `lib/growth/integrations/resend/client.test.ts`
- Update: `lib/server/resend.ts`

**Interfaces:**

- Consumes: an immutable, authorised Resend message snapshot
- Produces: provider message ID or typed provider error

- [ ] **Step 1: Write failing adapter tests**

Cover successful send, timeout, 429, 5xx retry, permanent validation failure, idempotency header, reply-to, list-unsubscribe headers, and redacted logs. Assert a `cold-outreach` category is rejected before any fetch.

- [ ] **Step 2: Define a narrow provider contract**

```ts
export type ResendMessage = {
  idempotencyKey: string;
  category:
    | "site-enquiry"
    | "resource-delivery"
    | "client-delivery-thank-you"
    | "newsletter-welcome"
    | "newsletter";
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
};

export interface ResendGateway {
  send(message: ResendMessage): Promise<{ providerMessageId: string }>;
}
```

- [ ] **Step 3: Implement the SDK adapter**

Import the Resend SDK only in `client.ts`. Pass the immutable message ID as the provider idempotency key. Classify retryable and permanent errors without exposing recipient or template content in logs.

- [ ] **Step 4: Preserve the old server entry point temporarily**

Convert `lib/server/resend.ts` into a compatibility wrapper around `ResendGateway`. Mark no public symbol deprecated until all current routes have migrated in Task 7.

- [ ] **Step 5: Run tests**

```bash
node --import tsx --test lib/growth/integrations/resend/client.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add -- lib/growth/integrations/resend lib/server/resend.ts
git commit -m "feat: isolate the Resend provider"
```

### Task 6: Add Consent And Suppression Services

**Files:**

- Create: `lib/growth/newsletter/subscribers.ts`
- Create: `lib/growth/newsletter/subscribers.test.ts`
- Create: `lib/growth/email/suppression.ts`
- Create: `lib/growth/email/suppression.test.ts`
- Create: `app/api/newsletter/unsubscribe/route.ts`
- Create: `app/api/newsletter/unsubscribe/route.test.ts`

**Interfaces:**

- Consumes: explicit consent or signed unsubscribe token
- Produces: active subscriber or monotonic suppression record

- [ ] **Step 1: Write failing domain tests**

Cover new opt-in, repeated opt-in, case-insensitive email identity, unsubscribe, complaint, bounce, re-consent after unsubscribe, expired or altered token, and a race between dispatch and unsubscribe.

- [ ] **Step 2: Implement explicit consent recording**

Record source, timestamp, form version, policy version, IP hash, and user-agent hash. Store hashes only when needed for evidence. Never infer consent from a contact form, resource request, or cold prospect record.

- [ ] **Step 3: Implement central suppression**

All providers query one `isSuppressed(normalisedEmail)` service before queue and again inside the dispatch transaction. Complaint and hard-bounce suppressions cannot be cleared from a public route.

- [ ] **Step 4: Implement signed one-click unsubscribe**

Use a purpose-bound, expiring HMAC token. The route is idempotent and returns the same safe response for unknown, already-unsubscribed, or valid recipients.

- [ ] **Step 5: Run tests**

```bash
node --import tsx --test lib/growth/newsletter/subscribers.test.ts lib/growth/email/suppression.test.ts app/api/newsletter/unsubscribe/route.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add -- lib/growth/newsletter lib/growth/email/suppression.ts lib/growth/email/suppression.test.ts app/api/newsletter
git commit -m "feat: enforce newsletter consent and suppression"
```

### Task 7: Move Existing Public Forms To PostgreSQL-First Processing

**Files:**

- Update: `app/api/lead/route.ts`
- Update: `app/api/intake/route.ts`
- Update: `lib/server/lead-submission.ts`
- Update: `lib/server/intake-submission.ts`
- Create: `lib/growth/inbound/submit-lead.ts`
- Create: `lib/growth/inbound/submit-lead.test.ts`
- Create: `tests/integration/growth/public-form-persistence.test.ts`

**Interfaces:**

- Consumes: current validated public form payloads
- Produces: one inbound lead, one queued acknowledgement, optional separate consent event

- [ ] **Step 1: Capture current route behaviour in tests**

Assert existing status codes, safe error shapes, honeypot handling, resource-delivery behaviour, and intake validation before changing persistence.

- [ ] **Step 2: Write a failing transaction test**

Assert the submission transaction:

1. inserts or returns the idempotent `inbound_leads` row
2. creates a prospect only when business data warrants one
3. creates one immutable Resend message snapshot
4. records newsletter consent only when the dedicated box is true
5. appends an audit event

The transaction must roll back fully on a database error.

- [ ] **Step 3: Implement the PostgreSQL-first service**

Use a client-generated submission UUID from the form as the idempotency key. Queue the requested email after the database commit. If Resend is temporarily unavailable, keep the message queued and return the accepted public response.

- [ ] **Step 4: Make HubSpot non-blocking**

If existing HubSpot sync remains configured, run it after the PostgreSQL transaction and record its outcome. A HubSpot failure must not remove or duplicate the local lead, and no historical import is part of this task.

- [ ] **Step 5: Keep routes thin**

Routes validate, call the service, map typed errors, and return. They do not import `postgres`, Resend, or HubSpot directly.

- [ ] **Step 6: Run regression tests**

```bash
node --import tsx --test lib/growth/inbound/submit-lead.test.ts tests/integration/growth/public-form-persistence.test.ts
pnpm test
```

- [ ] **Step 7: Commit**

```bash
git add -- app/api/lead/route.ts app/api/intake/route.ts lib/server/lead-submission.ts lib/server/intake-submission.ts lib/growth/inbound tests/integration/growth/public-form-persistence.test.ts
git commit -m "feat: persist public forms in PostgreSQL"
```

### Task 8: Add Newsletter Review, Test, And Schedule Services

**Files:**

- Create: `lib/growth/newsletter/issues.ts`
- Create: `lib/growth/newsletter/issues.test.ts`
- Create: `lib/growth/newsletter/dispatch.ts`
- Create: `lib/growth/newsletter/dispatch.test.ts`
- Create: `app/api/growth/newsletters/[id]/send-test/route.ts`
- Create: `app/api/growth/newsletters/[id]/approve-schedule/route.ts`
- Create: `app/api/cron/resend-dispatch/route.ts`
- Create: `app/api/cron/resend-dispatch/route.test.ts`
- Update: `vercel.json`

**Interfaces:**

- Consumes: founder-reviewed issue and active recipient snapshots
- Produces: founder test message, scheduled recipient messages, audited issue state

- [ ] **Step 1: Write failing issue-transition tests**

Valid transitions are `draft -> ready_for_review -> approved -> scheduled -> sending -> sent` with explicit `failed` and `cancelled` paths. Stale versions, unsent founder tests, missing consent, and missing unsubscribe URLs block scheduling.

- [ ] **Step 2: Implement founder test sending**

`send-test` requires `requireFounder`, renders the exact pending snapshot, sends only to the founder address, stores the provider ID, and does not alter subscriber state.

- [ ] **Step 3: Implement approval and scheduling**

Approval stores the immutable issue checksum and founder actor ID. Scheduling requires an optimistic concurrency version and future UTC timestamp. Recipient selection occurs at dispatch time so late unsubscribe and suppression changes are respected.

- [ ] **Step 4: Implement a bounded dispatcher**

Use `FOR UPDATE SKIP LOCKED`, a lease, batch limit, retry budget, and automation flag. Recheck consent and suppression within the same transaction that leases each message. Never log recipient content.

- [ ] **Step 5: Protect the cron route**

Require `CRON_SECRET`, use the Node runtime, return counts only, and no-op safely when `GROWTH_OS_AUTOMATIONS_ENABLED` is not `true`.

Add `/api/cron/resend-dispatch` to the existing Vercel cron array with schedule `*/5 * * * *`. Preserve the Gmail schedules and schema declaration.

- [ ] **Step 6: Run tests**

```bash
node --import tsx --test lib/growth/newsletter/issues.test.ts lib/growth/newsletter/dispatch.test.ts app/api/cron/resend-dispatch/route.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add -- lib/growth/newsletter app/api/growth/newsletters app/api/cron/resend-dispatch vercel.json
git commit -m "feat: schedule consented Resend messages"
```

### Task 9: Reconcile Signed Resend Webhooks

**Files:**

- Create: `lib/growth/integrations/resend/webhook.ts`
- Create: `lib/growth/integrations/resend/webhook.test.ts`
- Create: `app/api/webhooks/resend/route.ts`
- Create: `app/api/webhooks/resend/route.test.ts`

**Interfaces:**

- Consumes: raw body and Resend signature headers
- Produces: idempotent delivery event, message state, and suppression updates

- [ ] **Step 1: Write failing signature and replay tests**

Cover valid signature, modified body, missing headers, expired timestamp, unknown event type, replayed provider event, out-of-order delivery event, hard bounce, complaint, and unsubscribe.

- [ ] **Step 2: Verify before parsing**

Read the raw request body, verify with the Resend webhook secret and official verifier, then parse through a discriminated Zod union. Do not log raw payloads.

- [ ] **Step 3: Implement idempotent event application**

Insert the provider event ID first. A duplicate returns HTTP 200 without applying state twice. Monotonic rules prevent an older delivered event from clearing a later bounce or complaint.

- [ ] **Step 4: Apply suppression immediately**

Hard bounce or complaint creates the central suppression row, cancels queued Resend messages for the address, pauses any cold sequence for the same address, and appends an audit event.

- [ ] **Step 5: Run tests**

```bash
node --import tsx --test lib/growth/integrations/resend/webhook.test.ts app/api/webhooks/resend/route.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add -- lib/growth/integrations/resend/webhook.ts lib/growth/integrations/resend/webhook.test.ts app/api/webhooks/resend
git commit -m "feat: reconcile signed Resend events"
```

### Task 10: Verify The Complete Resend Marketing Slice

**Files:**

- Update: `.env.example`
- Update: `README.md`
- Create: `docs/runbooks/resend-marketing.md`
- Create: `tests/integration/growth/resend-marketing-flow.test.ts`

- [ ] **Step 1: Add non-secret configuration names**

Document `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, verified sender, reply-to, public URL, unsubscribe token key, and automation flag. Do not place usable credentials in source control.

- [ ] **Step 2: Add the runbook**

Document domain verification, sender setup, webhook registration, test-recipient policy, replay handling, suppression recovery, disabling the dispatcher, and the explicit prohibition on cold outreach through Resend.

- [ ] **Step 3: Add an end-to-end service test**

Exercise form submission, idempotent persistence, requested email rendering, consent creation, newsletter test, scheduling, dispatch, webhook delivery, unsubscribe, and a blocked later send using fake providers and a local database.

- [ ] **Step 4: Run the subsystem and project checks**

```bash
supabase db reset
node --import tsx --test tests/integration/growth/resend-marketing-flow.test.ts
pnpm test
pnpm test:redesign
pnpm lint
pnpm build
```

- [ ] **Step 5: Inspect every changed file and the final diff**

Confirm no SDK leaks into routes or templates, no cold category can reach Resend, no consent is inferred, no secret is committed, and the full HTML/plain-text copy matches the approved standard.

- [ ] **Step 6: Commit**

```bash
git add -- .env.example README.md docs/runbooks/resend-marketing.md tests/integration/growth/resend-marketing-flow.test.ts
git commit -m "docs: add Resend marketing operations"
```

## Plan 04 Exit Gate

- [ ] Public forms persist in PostgreSQL before provider calls.
- [ ] Requested messages and newsletters render as complete HTML and plain text.
- [ ] All replies route to the founder Workspace address.
- [ ] Cold prospect data cannot enter the Resend adapter.
- [ ] Newsletter sends require current consent and no suppression.
- [ ] Webhook replay and out-of-order events are safe.
- [ ] Full project checks pass before review.
