# FSS Growth OS Gmail Outreach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send founder-approved cold outreach and safe template follow-ups from Google Workspace while keeping every reply in Gmail and stopping automation before an inappropriate send.

**Architecture:** A separate Google OAuth connection grants offline Gmail access to the founder mailbox. Domain services snapshot approved content in PostgreSQL, create deterministic MIME messages, and queue sends. Cron services synchronise reply metadata before leasing due messages and adding follow-ups to the original Gmail thread.

**Tech Stack:** Google OAuth 2.0, Gmail REST API, Node crypto, Next.js Route Handlers, Vercel Cron Jobs, Supabase PostgreSQL, date-fns with `@date-fns/tz`, Zod, Node test runner.

## Global Constraints

- Dashboard sign-in OAuth and Gmail automation OAuth are separate clients.
- The Gmail connection subject must be `j.ntagengwa@faithfulsoftware.dev`.
- Store the refresh token encrypted with AES-256-GCM and a versioned key.
- Store no direct reply body in PostgreSQL.
- The first email requires founder approval.
- Follow-ups use immutable template snapshots on Days 5, 11, and 20.
- All sequence stop conditions are monotonic.
- Reply synchronisation and a final thread check happen before every due send.
- Resend is not imported into this subsystem.

---

### Task 1: Add Outreach Schema And State Constraints

**Files:**

- Create through CLI: `supabase/migrations/*_growth_gmail_outreach.sql`
- Create: `tests/integration/growth/outreach-schema.test.ts`

**Interfaces:**

- Consumes: foundation and research schema
- Produces: `email_templates`, `sequence_enrollments`, `email_messages`, `email_events`, `suppressions`

- [ ] **Step 1: Generate the migration**

```bash
supabase migration new growth_gmail_outreach
```

- [ ] **Step 2: Write a failing schema test**

Assert all five tables and the data-contract unique indexes exist. Assert the runtime role cannot update or delete `audit_log` and cannot delete `suppressions`.

- [ ] **Step 3: Implement the migration**

Use the columns and status values in `docs/growth-os/data-api-security.md`. Include:

```sql
create unique index unique_template_version
  on growth.email_templates (channel, template_key, version);

create unique index unique_message_idempotency
  on growth.email_messages (idempotency_key);

create unique index unique_rfc_message_id
  on growth.email_messages (rfc_message_id);

create index due_email_messages
  on growth.email_messages (scheduled_for)
  where status in ('queued', 'retry');

create unique index unique_provider_event
  on growth.email_events (provider, provider_event_id);

create unique index unique_suppression_email
  on growth.suppressions (normalised_email);

revoke delete on growth.suppressions from growth_app;
```

Add a trigger that rejects updates to sent message subject, HTML, text, visual asset, and RFC Message-ID. Add a trigger that rejects a transition from any stopped or completed sequence state back to active.

- [ ] **Step 4: Seed versioned follow-up templates**

Seed Gmail Day 5, 11, and 20 templates from `docs/growth-os/email-content-and-image-standard.md`. Store both HTML and plain text, required fields `firstName` and `businessName`, status `published`, version `1.0`, and a SHA-256 checksum.

- [ ] **Step 5: Reset and verify**

```bash
supabase db reset
node --import tsx --test tests/integration/growth/outreach-schema.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add -- supabase/migrations tests/integration/growth/outreach-schema.test.ts
git commit -m "feat: add Gmail outreach schema"
```

### Task 2: Encrypt And Store The Gmail Connection

**Files:**

- Create: `lib/growth/integrations/token-crypto.ts`
- Create: `lib/growth/integrations/token-crypto.test.ts`
- Create: `lib/growth/integrations/google-oauth.ts`
- Create: `lib/growth/integrations/gmail-connection.ts`

**Interfaces:**

- Consumes: OAuth code, token encryption key, integration repository
- Produces: `encryptRefreshToken`, `decryptRefreshToken`, Gmail connection service

- [ ] **Step 1: Write failing encryption tests**

Cover round trip, random IV producing different ciphertext, modified authentication tag, wrong key, and unsupported key version.

```ts
const encrypted = encryptRefreshToken("refresh-token", {
  version: "v1",
  key: Buffer.alloc(32, 7),
});
assert.notEqual(encrypted.ciphertext, "refresh-token");
assert.equal(
  decryptRefreshToken(encrypted, { v1: Buffer.alloc(32, 7) }),
  "refresh-token",
);
```

- [ ] **Step 2: Implement AES-256-GCM**

Use a fresh 12-byte IV and 16-byte tag. Store a versioned encoded envelope, not raw binary columns:

```ts
export type EncryptedToken = {
  version: "v1";
  iv: string;
  ciphertext: string;
  authTag: string;
};
```

The environment key is base64-encoded 32-byte material. Reject an incorrect length.

- [ ] **Step 3: Implement direct OAuth token exchange**

Use `fetch` against Google's documented OAuth endpoints. Request:

- `openid`
- `email`
- `https://www.googleapis.com/auth/gmail.modify`

Set `access_type=offline`, `include_granted_scopes=true`, `prompt=consent` for the initial connection, and an unpredictable state value held in a secure HTTP-only cookie. Do not use the dashboard Auth.js client.

- [ ] **Step 4: Store the connection**

Fetch the authorised profile and reject any subject email other than the founder address. Encrypt the refresh token and upsert one `integration_connections` row with provider `gmail`, granted scopes, cursor, status, and audit event.

- [ ] **Step 5: Run tests**

```bash
node --import tsx --test lib/growth/integrations/token-crypto.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add -- lib/growth/integrations/token-crypto.ts lib/growth/integrations/token-crypto.test.ts lib/growth/integrations/google-oauth.ts lib/growth/integrations/gmail-connection.ts
git commit -m "security: encrypt Gmail automation tokens"
```

### Task 3: Add Founder-Controlled Gmail OAuth Routes

**Files:**

- Create: `app/api/integrations/gmail/connect/route.ts`
- Create: `app/api/integrations/gmail/callback/route.ts`
- Create: `app/api/integrations/gmail/disconnect/route.ts`
- Create: `app/api/integrations/gmail/routes.test.ts`

**Interfaces:**

- Consumes: `requireFounder`, Google OAuth service
- Produces: connect, callback, and disconnect endpoints

- [ ] **Step 1: Write route tests**

Cover unauthorized founder, state mismatch, provider error, wrong Google subject, missing refresh token, successful connection, and disconnect.

- [ ] **Step 2: Implement thin routes**

Every route calls `requireFounder`. The callback verifies state before exchanging the code. Disconnect revokes the token at Google when possible, clears the encrypted token, sets status `revoked`, pauses all active sequences, and appends audit events.

- [ ] **Step 3: Run tests**

```bash
node --import tsx --test app/api/integrations/gmail/routes.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add -- app/api/integrations/gmail
git commit -m "feat: add founder-controlled Gmail connection"
```

### Task 4: Build Deterministic Gmail MIME Messages

**Files:**

- Create: `lib/growth/email/gmail/mime.ts`
- Create: `lib/growth/email/gmail/mime.test.ts`
- Create: `lib/growth/email/gmail/render.ts`
- Create: `lib/growth/email/gmail/render.test.ts`

**Interfaces:**

- Consumes: approved message snapshot and optional thread headers
- Produces: base64url Gmail `raw`, deterministic Message-ID, HTML and plain-text parity

- [ ] **Step 1: Write failing MIME tests**

Assert:

- CRLF line endings
- RFC 2047-safe subject
- Multipart alternative includes text and HTML
- Deterministic `Message-ID: <growthos.<uuid>@faithfulsoftware.dev>`
- Follow-up includes matching subject, `In-Reply-To`, and `References`
- HTML contains one image URL, alt text, and visible concept disclaimer
- No tracking pixel, recipient identifier in the image URL, or hidden 1px image
- Base64url output contains no `+`, `/`, or `=` padding

- [ ] **Step 2: Implement the renderer**

```ts
export type GmailMessageInput = {
  id: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo: string;
  thread?: {
    gmailThreadId: string;
    parentMessageId: string;
    references: string[];
  };
};

export type RenderedGmailMessage = {
  raw: string;
  rfcMessageId: string;
  gmailThreadId?: string;
};
```

Escape headers against CRLF injection. Render the full first-email copy from the immutable draft snapshot. Follow-ups render only allowlisted merge fields through the published template snapshot.

- [ ] **Step 3: Run tests**

```bash
node --import tsx --test lib/growth/email/gmail/mime.test.ts lib/growth/email/gmail/render.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add -- lib/growth/email/gmail
git commit -m "feat: render safe Gmail outreach messages"
```

### Task 5: Add The Gmail Provider Adapter

**Files:**

- Create: `lib/growth/integrations/gmail/client.ts`
- Create: `lib/growth/integrations/gmail/client.test.ts`
- Create: `lib/growth/integrations/gmail/types.ts`

**Interfaces:**

- Consumes: access token, rendered Gmail message
- Produces: typed draft, send, history, metadata, and reconciliation operations

- [ ] **Step 1: Write adapter tests with fake fetch**

Cover token refresh, draft create, draft send, direct send, history page traversal, 401 refresh, 429 retry classification, 5xx retry classification, 4xx permanent error, and response schema failure.

- [ ] **Step 2: Implement the narrow client**

```ts
export interface GmailClient {
  createDraft(input: GmailCreateDraftInput): Promise<GmailDraftResult>;
  sendDraft(draftId: string): Promise<GmailSendResult>;
  sendMessage(input: GmailSendInput): Promise<GmailSendResult>;
  listHistory(input: GmailHistoryInput): Promise<GmailHistoryResult>;
  getMessageMetadata(messageId: string): Promise<GmailMessageMetadata>;
  findByRfcMessageId(
    rfcMessageId: string,
  ): Promise<GmailMessageMetadata | null>;
  getProfile(): Promise<{ emailAddress: string; historyId: string }>;
}
```

Use Google's documented REST endpoints and Zod-validate every response. Never log access tokens or raw messages.

- [ ] **Step 3: Run tests and commit**

```bash
node --import tsx --test lib/growth/integrations/gmail/client.test.ts
git add -- lib/growth/integrations/gmail
git commit -m "feat: add typed Gmail provider adapter"
```

### Task 6: Materialise And Approve The First Email

**Files:**

- Create: `lib/growth/sequences/approval.ts`
- Create: `lib/growth/sequences/approval.test.ts`
- Create: `lib/growth/sequences/edit-first-email.ts`
- Create: `lib/growth/sequences/edit-first-email.test.ts`
- Create: `app/api/growth/messages/[id]/edit-draft/route.ts`
- Create: `app/api/growth/messages/[id]/create-gmail-draft/route.ts`
- Create: `app/api/growth/messages/[id]/approve-send/route.ts`
- Create: `app/api/growth/messages/[id]/needs-redraft/route.ts`

**Interfaces:**

- Consumes: founder session, research draft, approved visual, suppression service
- Produces: founder-authored draft revision, Gmail draft, or queued approved sequence

- [ ] **Step 1: Write approval tests**

Cover ready draft, valid manual revision, header injection, invalid subject, copy outside the 140 to 220 word range, missing opt-out, missing visual, unapproved visual, missing plain text, missing disclaimer, suppressed contact, non-corporate contact, stale entity version, duplicate approval, successful immutable snapshot, and a Gmail draft that does not activate follow-ups before it is actually sent.

- [ ] **Step 2: Implement safe founder editing**

`reviseFirstEmailDraft` accepts subject and structured plain-text paragraphs, not arbitrary HTML. Validate the content standard, re-render HTML and plain text through the Gmail renderer, retain the reviewed visual, increment the draft version, record the founder as editor, and append an audit event. Preserve the previous revision. Reject editing after approval or provider draft creation.

- [ ] **Step 3: Implement `approveFirstEmail`**

```ts
export type ApproveFirstEmailInput = {
  draftTaskId: string;
  expectedVersion: number;
  founder: FounderSession;
  sendMode: "queue" | "gmail_draft";
};

export async function approveFirstEmail(
  input: ApproveFirstEmailInput,
): Promise<QueuedMessage>;
```

Inside one transaction, lock the draft, revalidate evidence and suppression, snapshot the copy and visual, create the sequence, create the first message intent, and append the audit event. `queue` sets the first message to `queued`. `gmail_draft` creates the provider draft after commit, stores its draft and RFC identifiers, and leaves the sequence awaiting manual send. Set later messages only after Gmail confirms the first provider message was actually sent so their due times derive from the real send time.

- [ ] **Step 4: Implement the four thin routes**

Each route calls `requireFounder`, validates entity version, calls the service, and returns safe data. `edit-draft` creates a new founder-authored revision. `needs-redraft` creates an agent task for the next scheduled Codex run and never calls an AI API.

- [ ] **Step 5: Run tests**

```bash
node --import tsx --test lib/growth/sequences/edit-first-email.test.ts lib/growth/sequences/approval.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add -- lib/growth/sequences/approval.ts lib/growth/sequences/approval.test.ts lib/growth/sequences/edit-first-email.ts lib/growth/sequences/edit-first-email.test.ts app/api/growth/messages
git commit -m "feat: approve first Gmail outreach safely"
```

### Task 7: Dispatch Due Messages With Leases And Reconciliation

**Files:**

- Create: `lib/growth/sequences/dispatcher.ts`
- Create: `lib/growth/sequences/dispatcher.test.ts`
- Create: `lib/growth/sequences/repository.ts`
- Create: `lib/growth/sequences/schedule.ts`
- Create: `lib/growth/sequences/schedule.test.ts`

**Interfaces:**

- Consumes: current time, Gmail client, sequence repository
- Produces: `dispatchDueOutreach`

- [ ] **Step 1: Write race and retry tests**

Cover:

- Two workers claim one message only once
- Expired lease can be reclaimed
- Active lease cannot be stolen
- Suppression after queue cancels the message
- Reply state after queue cancels the message
- Missing merge field blocks send
- Lost provider response reconciles through deterministic RFC Message-ID
- Permanent provider failure stops the sequence and surfaces an action
- Successful first send creates Day 5, 11, and 20 rows in Europe/London-derived UTC timestamps
- A Saturday or Sunday follow-up moves to Monday at 10:00 Europe/London
- Scheduling across UK daylight-saving changes preserves the 10:00 local send time

- [ ] **Step 2: Implement the deterministic follow-up schedule**

Install `@date-fns/tz` beside the existing date-fns dependency. Use calendar offsets 4, 10, and 19 from the actual first-send time for labels Day 5, Day 11, and Day 20. Set each follow-up to 10:00 `Europe/London`, move Saturday or Sunday forward to Monday, then store the resulting UTC instant. Document that bank-holiday scheduling is outside the MVP.

- [ ] **Step 3: Implement claim and lease SQL**

Use one transaction with `FOR UPDATE SKIP LOCKED` to change one due message to `sending`, set a random lease token, increment attempts, and set a five-minute expiry.

- [ ] **Step 4: Implement provider reconciliation**

Before retrying a message whose provider outcome is unknown, call `findByRfcMessageId`. If found, record it as sent. Do not resend.

- [ ] **Step 5: Implement `dispatchDueOutreach`**

```ts
export type DispatchSummary = {
  claimed: number;
  sent: number;
  cancelled: number;
  reconciled: number;
  retryableFailures: number;
  permanentFailures: number;
};

export async function dispatchDueOutreach(now: Date): Promise<DispatchSummary>;
```

Call reply synchronisation before claiming. Immediately before the provider call, check the thread once more for inbound metadata newer than the last outbound message.

- [ ] **Step 6: Run tests and commit**

```bash
node --import tsx --test lib/growth/sequences/schedule.test.ts lib/growth/sequences/dispatcher.test.ts
git add -- lib/growth/sequences/dispatcher.ts lib/growth/sequences/dispatcher.test.ts lib/growth/sequences/repository.ts lib/growth/sequences/schedule.ts lib/growth/sequences/schedule.test.ts
git commit -m "feat: dispatch Gmail follow-ups idempotently"
```

### Task 8: Synchronise Replies And Enforce Stop States

**Files:**

- Create: `lib/growth/sequences/gmail-sync.ts`
- Create: `lib/growth/sequences/gmail-sync.test.ts`
- Create: `lib/growth/sequences/stop.ts`
- Create: `lib/growth/sequences/stop.test.ts`
- Create: `app/api/growth/sequences/[id]/pause/route.ts`
- Create: `app/api/growth/sequences/[id]/started-talks/route.ts`
- Create: `app/api/growth/sequences/[id]/reject/route.ts`
- Create: `app/api/growth/sequences/[id]/do-not-contact/route.ts`

**Interfaces:**

- Consumes: Gmail history metadata and founder actions
- Produces: `syncGmailReplies`, `stopSequence`

- [ ] **Step 1: Write sync tests**

Cover inbound reply, own sent message, automated response, bounce, history cursor expiration, duplicate history page, a reply that races a leased send, a founder-sent provider draft reconciled by RFC Message-ID, and an unsent or deleted provider draft.

- [ ] **Step 2: Write stop tests**

Cover pause, started talks, rejected, do not contact, reply, bounce, and repeated stop request. `do_not_contact` inserts global suppression. Every stop cancels queued or retry messages.

- [ ] **Step 3: Implement sync without reply bodies**

Store provider message ID, thread ID, sender header, subject, RFC Message-ID, received time, and event type. Do not store the body or snippet. Any inbound message from outside the founder mailbox on an active thread stops the sequence as reply. A bounce creates suppression and stops as bounce. When the founder sends a provider draft, reconcile its deterministic RFC Message-ID, mark the first message sent, activate the sequence, and schedule follow-ups from the actual sent time. An unsent or deleted draft never schedules a follow-up and surfaces a founder action.

- [ ] **Step 4: Implement monotonic stop service**

```ts
export type StopSequenceInput = {
  sequenceId: string;
  reason:
    | "pause"
    | "started_talks"
    | "rejected"
    | "do_not_contact"
    | "reply"
    | "bounce";
  actor: FounderSession | { type: "gmail_sync"; id: string };
};
```

The same reason is idempotent. A later attempt to reactivate throws. Resuming a paused contact requires a new sequence and approval.

- [ ] **Step 5: Add founder routes and tests**

Each founder route repeats authorization and optimistic concurrency. `do-not-contact` also writes suppression.

- [ ] **Step 6: Run tests and commit**

```bash
node --import tsx --test lib/growth/sequences/gmail-sync.test.ts lib/growth/sequences/stop.test.ts
git add -- lib/growth/sequences app/api/growth/sequences
git commit -m "feat: stop outreach on replies and founder actions"
```

### Task 9: Add Secured Cron Routes

**Files:**

- Create: `lib/growth/http/cron-auth.ts`
- Create: `lib/growth/http/cron-auth.test.ts`
- Create: `app/api/cron/gmail-sync/route.ts`
- Create: `app/api/cron/outreach-dispatch/route.ts`
- Create: `vercel.json`

**Interfaces:**

- Consumes: `CRON_SECRET`, automation flag, sync and dispatch services
- Produces: production-only cron entry points

- [ ] **Step 1: Write cron authorization tests**

Cover missing header, wrong bearer, exact bearer, missing secret, and disabled automations.

- [ ] **Step 2: Implement cron guard**

Use timing-safe equality and fail closed. When automations are disabled, return `200` with `{ ok: true, skipped: "automations_disabled" }` and perform no provider or database mutation.

- [ ] **Step 3: Add thin routes**

`gmail-sync` calls only `syncGmailReplies`. `outreach-dispatch` calls sync first, then dispatch. Both return counts only.

- [ ] **Step 4: Configure UTC cron schedules**

Create:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/cron/gmail-sync", "schedule": "*/10 * * * *" },
    { "path": "/api/cron/outreach-dispatch", "schedule": "*/5 * * * *" }
  ]
}
```

Vercel cron runs in UTC and only on production deployments. Business due times are already absolute timestamps.

- [ ] **Step 5: Run full plan verification**

```bash
supabase db reset
pnpm test:growth
pnpm test:redesign
pnpm lint
pnpm build
```

- [ ] **Step 6: Perform a live sandbox verification only with explicit approval**

Use the founder-controlled mailbox and a founder-controlled recipient. Verify create draft, send, same-thread follow-up, reply detection, and sequence stop. Do not use a real prospect.

- [ ] **Step 7: Commit**

```bash
git add -- lib/growth/http/cron-auth.ts lib/growth/http/cron-auth.test.ts app/api/cron/gmail-sync app/api/cron/outreach-dispatch vercel.json
git commit -m "feat: schedule safe Gmail outreach processing"
```
