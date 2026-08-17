# FSS Growth OS Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the founder-only FSS Growth OS from scheduled prospect research through approved Gmail outreach, PostgreSQL pipeline management, complete Resend marketing emails, and a controlled Vercel release.

**Architecture:** Keep the existing Next.js application and add a private `/growth` area backed by a private PostgreSQL schema. Vercel route handlers own all provider and database access. A separate scheduled Codex task sends signed research bundles into the application. Gmail handles cold outreach; Resend handles requested and opted-in email.

**Tech Stack:** Next.js 16 App Router, React 19, strict TypeScript, Zod 4, Tailwind CSS 4, Supabase PostgreSQL, `postgres`, Auth.js, Google OAuth and Gmail REST API, Resend, React Email, Vercel Functions, Vercel Cron Jobs, Vercel Blob, Node test runner, pnpm 9.7.0.

## Global Constraints

- The only dashboard account is `j.ntagengwa@faithfulsoftware.dev`.
- Supabase is PostgreSQL only. Do not add Supabase Auth or a browser Supabase client.
- Keep all Growth OS tables in a private `growth` schema and keep the Data API out of the runtime path.
- Keep Netlify production active until a Vercel preview passes and Jean-Fidele explicitly approves the domain cutover.
- Do not deploy production or change DNS without explicit approval.
- Do not call an OpenAI, GPT, or image-generation API in the MVP.
- Paid AI APIs require a separate human decision after GBP 5,000 MRR.
- Cold outreach uses Gmail. Resend must never send unsolicited cold outreach.
- The founder approves every first cold email.
- Follow-ups send on Days 5, 11, and 20 in the same Gmail thread.
- Reply, opt-out, bounce, rejection, started talks, won, lost, suppression, or manual pause stops the sequence.
- First cold emails are complete text-first messages with one generated visual, plain text, alt text, and no tracking pixel.
- Resend templates contain complete marketing copy, accessible generated imagery, plain text, and a Workspace Reply-To address.
- Treat Google Maps as discovery only. Persist only a place ID and reference URL, not reviews, photos, rating values, or copied listing text.
- Automate unsolicited email only for verified corporate subscribers. Treat sole traders and uncertain partnerships as individual subscribers and reject or hold them.
- Preserve the existing FSS site design tokens and public behaviour unless a plan explicitly changes them.
- Use strict TypeScript. Do not use `any`, suppression comments, or browser-visible secrets.
- Use TDD for domain logic, provider adapters, signatures, idempotency, suppression, and state transitions.
- Every implementation plan is a separate review gate and should normally produce its own pull request.

---

## Document Map

- Design: `docs/superpowers/specs/2026-08-16-fss-growth-os-design.md`
- Data/API/security: `docs/growth-os/data-api-security.md`
- Email and image standard: `docs/growth-os/email-content-and-image-standard.md`
- Mockups: `docs/growth-os/mockups/`

## Dependency Decisions

Add only when the plan that consumes the package starts:

| Package                   | Plan | Reason                                                                                |
| ------------------------- | ---- | ------------------------------------------------------------------------------------- |
| `postgres`                | 01   | Server-side PostgreSQL driver with explicit transaction-pooler configuration          |
| `next-auth`               | 01   | Reviewed Google OIDC session handling for the founder dashboard                       |
| `@vercel/blob`            | 02   | Stable public URLs for generated email visuals without storing binaries in PostgreSQL |
| `sharp`                   | 02   | Strip metadata, validate, resize, and compress uploaded generated visuals             |
| `@date-fns/tz`            | 03   | Correct Europe/London follow-up scheduling across daylight-saving changes             |
| `resend`                  | 04   | Supported send, webhook verification, contacts, and broadcast client                  |
| `@react-email/components` | 04   | Accessible, reusable email templates                                                  |
| `@react-email/render`     | 04   | Deterministic HTML and plain-text rendering                                           |

Do not add `@supabase/supabase-js`, `googleapis`, an AI SDK, a client state library, or a second ORM.

## Shared File Structure

```text
app/
  (growth)/growth/
  api/agent/
  api/auth/
  api/cron/
  api/growth/
  api/integrations/gmail/
  api/webhooks/resend/
components/growth/
emails/
lib/growth/
  auth/
  audit/
  db/
  email/
  integrations/
  prospects/
  sequences/
  newsletter/
  pipeline/
supabase/
  migrations/
tests/integration/growth/
```

Pages and route handlers stay thin. Domain services under `lib/growth/` own rules. Repositories isolate SQL. Provider adapters isolate external APIs.

## Execution Sequence

### Plan 01: Foundation

Deliverable: private schema, connection layer, environment validation, founder authentication, audit foundation, and local test harness.

Entry conditions:

- Planning PR merged
- Lower-cost execution model selected
- Supabase CLI available

Exit gate:

- Founder can sign in locally
- Other accounts are rejected
- Local migration reset passes
- Database role and schema exposure assertions pass

### Plan 02: Research And Ingestion

Deliverable: signed research-run ingestion, generated visual upload, deduplication, evidence validation, and weekday Codex runbook.

Entry condition: Plan 01 merged.

Exit gate:

- One fixture run inserts atomically
- Retry returns the same result
- Invalid corporate status, source, signature, visual, or suppression blocks acceptance

### Plan 03: Gmail Outreach

Deliverable: separate Gmail OAuth connection, first-email approval, draft/send, thread-safe follow-ups, reply sync, and stop-state enforcement.

Entry condition: Plans 01 and 02 merged.

Exit gate:

- Sandbox send reaches the founder-controlled test mailbox
- Message is reconciled after a simulated timeout
- Reply and stop races never produce a later send

### Plan 04: Resend Marketing

Deliverable: PostgreSQL-first public forms, complete React Email templates, consent records, newsletter sending, and signed Resend webhooks.

Entry condition: Plan 01 merged. It can run in parallel with Plan 03 only if implementation staffing permits.

Exit gate:

- Site acknowledgement and newsletter test render in HTML and plain text
- Newsletter service rejects non-consented addresses
- Webhook replay is idempotent
- All replies route to the Workspace address

### Plan 05: Founder Dashboard

Deliverable: the approved responsive screens and every founder action needed to operate research, approval, outreach, website strategy, and newsletters.

Entry condition: Plans 01 through 04 merged.

Exit gate:

- Desktop screens match the approved mockups
- Critical mobile overview and first-email approval match their mobile references
- Empty, loading, error, stale integration, and success states exist
- All sensitive actions require a fresh server authorization check

### Plan 06: Pipeline And Delivery

Deliverable: pipeline, deal, client, delivery, and analytics transitions built on the same prospect and engagement records.

Entry condition: Plans 01, 04, and 05 merged.

Exit gate:

- Stage transitions preserve audit history
- Pipeline totals reconcile with engagement records
- Won work appears in the client and delivery views without duplication

### Plan 07: Release

Deliverable: Vercel project configuration, preview verification, operator runbooks, cutover checklist, rollback path, and post-cutover Netlify retirement plan.

Entry condition: Plans 01 through 06 merged and green.

Exit gate:

- Vercel preview passes every check
- Founder signs off on the preview
- Production cutover is separately approved
- Automations remain disabled until the production smoke test passes

## Cross-Plan Interfaces

The implementation must stabilise these exports in Plan 01:

```ts
export type FounderSession = {
  email: string;
  actorId: string;
};

export async function requireFounder(): Promise<FounderSession>;

export type GrowthDb = ReturnType<typeof createGrowthDb>;

export function createGrowthDb(connectionString: string): GrowthDb;

export type AuditInput = {
  correlationId: string;
  actorType: "founder" | "agent" | "cron" | "provider" | "system";
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export async function appendAuditEvent(
  db: GrowthDb,
  input: AuditInput,
): Promise<void>;
```

Plan 02 must stabilise:

```ts
export type ResearchRunIngestion;
export type ResearchRunIngestionResult;

export async function ingestResearchRun(
  db: GrowthDb,
  input: ResearchRunIngestion,
): Promise<ResearchRunIngestionResult>;
```

Plan 03 must stabilise:

```ts
export async function approveFirstEmail(
  input: ApproveFirstEmailInput,
): Promise<QueuedMessage>;
export async function dispatchDueOutreach(now: Date): Promise<DispatchSummary>;
export async function syncGmailReplies(now: Date): Promise<GmailSyncSummary>;
export async function stopSequence(
  input: StopSequenceInput,
): Promise<SequenceEnrollment>;
```

Plan 04 must stabilise:

```ts
export async function recordInboundLead(
  input: InboundLeadInput,
): Promise<InboundLead>;
export async function sendSiteAcknowledgement(
  leadId: string,
): Promise<EmailMessage>;
export async function scheduleNewsletter(
  input: ScheduleNewsletterInput,
): Promise<NewsletterIssue>;
```

Plan 05 consumes these services through server actions and read models. It does not import provider SDKs.

## Standard Test Commands

Implementation plans add these scripts to `package.json`:

```json
{
  "scripts": {
    "test:unit": "node --import tsx --test 'lib/**/*.test.ts' 'components/**/*.test.ts'",
    "test:integration:growth": "node --import tsx --test 'tests/integration/growth/**/*.test.ts'",
    "test:growth": "pnpm test:unit && pnpm test:integration:growth"
  }
}
```

Every implementation pull request runs:

```bash
pnpm test:growth
pnpm test:redesign
pnpm lint
pnpm build
```

Database plans also run:

```bash
supabase db reset
supabase migration list --local
```

Provider plans run fixture tests by default. Live Gmail, Resend, Blob, Supabase remote, and Vercel calls require an explicit operator step and must target test recipients or preview environments.

## Commit And Pull Request Strategy

- One implementation plan per branch and pull request.
- One independently testable task per commit where practical.
- Do not combine provider setup, dashboard build, and production cutover in one pull request.
- Never stage unrelated files.
- Pull requests are drafts until local checks pass.
- Production cutover remains a manual release action even after the release pull request merges.

## Definition Of Done

- Every requirement in the design spec maps to a completed plan task.
- Every state transition and send path has deterministic tests.
- Every provider call is behind a typed adapter.
- Every external input is validated.
- Every protected action repeats founder authorization on the server.
- Every send checks suppression and sequence state immediately before the provider call.
- Every email has a durable content snapshot and audit event.
- Every generated image is reviewed, accessible, compressed, and non-deceptive.
- All relevant checks pass in CI.
- Operator runbooks contain no credentials.
- The founder approves the Vercel preview before production changes.
