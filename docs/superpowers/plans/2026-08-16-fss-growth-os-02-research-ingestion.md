# FSS Growth OS Research And Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accept complete weekday Codex research bundles, generated prospect visuals, evidence, website assessments, and first-email drafts through a signed, idempotent server interface.

**Architecture:** The scheduled Codex task researches ten qualified Kent corporate prospects and submits one signed JSON run bundle with reviewed fallback selections. Vercel validates the signature and every nested object before one PostgreSQL transaction deduplicates and inserts the run. The response maps each accepted input index to its persisted prospect ID. The task then uploads each available generated visual through the signed asset route, which atomically switches that prospect's draft from fallback to canonical stored asset metadata.

**Tech Stack:** Next.js Route Handlers, Zod 4, Node crypto, Supabase PostgreSQL, Vercel Blob, Sharp, Node test runner.

## Global Constraints

- Apply the master plan and data contract.
- Research runs occur at 06:00 Europe/London on weekdays outside the application.
- Google Maps is discovery only. Persist only a place ID and reference URL.
- Automated acceptance requires a verified corporate subscriber.
- No paid AI API exists in this workflow.
- A missing custom visual uses an approved sector fallback. It never triggers an API call.
- A malformed prospect cannot create a partial business, contact, or email record.

---

### Task 1: Add Research, Evidence, Assessment, And Asset Tables

**Files:**

- Create through CLI: `supabase/migrations/*_growth_research_ingestion.sql`
- Create: `tests/integration/growth/research-schema.test.ts`

**Interfaces:**

- Consumes: Plan 01 foundation tables
- Produces: `research_runs`, `agent_tasks`, `source_evidence`, `website_assessments`, `email_assets`

- [ ] **Step 1: Generate the migration**

```bash
supabase migration new growth_research_ingestion
```

- [ ] **Step 2: Write a failing schema test**

Assert the five tables exist, `research_runs.external_run_id` and `agent_tasks.idempotency_key` are unique, and `anon` plus `authenticated` have no schema usage.

- [ ] **Step 3: Run the test and verify RED**

```bash
node --import tsx --test tests/integration/growth/research-schema.test.ts
```

- [ ] **Step 4: Implement the migration**

Use the exact columns from `docs/growth-os/data-api-security.md`. Add these checks:

```sql
alter table growth.research_runs
  add constraint research_run_target_positive check (target_count > 0),
  add constraint research_run_counts_nonnegative check (
    accepted_count >= 0 and duplicate_count >= 0 and rejected_count >= 0
  );

alter table growth.email_assets
  add constraint cold_asset_size check (
    asset_kind <> 'cold_first_email' or byte_size <= 184320
  ),
  add constraint email_asset_dimensions check (width > 0 and height > 0),
  add constraint email_asset_alt_text check (length(trim(alt_text)) >= 20);

create unique index unique_research_external_run
  on growth.research_runs (external_run_id);

create unique index unique_agent_task_idempotency
  on growth.agent_tasks (idempotency_key);

create unique index unique_evidence_claim
  on growth.source_evidence (prospect_id, source_url, claim_type);

create unique index unique_email_asset_hash
  on growth.email_assets (sha256);
```

Add the deferred foreign key from `growth.prospects.research_run_id` to `growth.research_runs.id`.

- [ ] **Step 5: Reset and verify GREEN**

```bash
supabase db reset
node --import tsx --test tests/integration/growth/research-schema.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add -- supabase/migrations tests/integration/growth/research-schema.test.ts
git commit -m "feat: add Growth OS research schema"
```

### Task 2: Define The Versioned Ingestion Contract

**Files:**

- Create: `lib/growth/research/ingestion-schema.ts`
- Create: `lib/growth/research/ingestion-schema.test.ts`
- Create: `lib/growth/research/types.ts`

**Interfaces:**

- Consumes: Zod
- Produces: `ResearchRunIngestion`, `ResearchRunIngestionResult`, `parseResearchRunIngestion`

- [ ] **Step 1: Write failing contract tests**

Create a valid fixture with one prospect. Add one rejection test for each rule:

- Wrong schema version
- County outside Kent
- Sole trader or uncertain subscriber
- Inactive company
- Missing Companies House evidence
- Google Maps rating, review text, or photo field present
- Personal mailbox domain used without manual review
- Missing email opt-out line
- Missing image disclaimer or alt text
- Fit score outside 0 through 100
- Fewer than one first-party or Companies House source

Example assertion:

```ts
const parsed = parseResearchRunIngestion(validFixture);
assert.equal(parsed.schemaVersion, "1.0");
assert.equal(parsed.prospects[0]?.business.county, "Kent");

assert.throws(
  () =>
    parseResearchRunIngestion({
      ...validFixture,
      prospects: [
        {
          ...validFixture.prospects[0],
          contact: {
            ...validFixture.prospects[0].contact,
            subscriberType: "individual",
          },
        },
      ],
    }),
  /corporate subscriber/i,
);
```

- [ ] **Step 2: Run tests and verify RED**

```bash
node --import tsx --test lib/growth/research/ingestion-schema.test.ts
```

- [ ] **Step 3: Implement strict schemas**

Export these versioned types:

```ts
export type BusinessCandidate = {
  legalName: string;
  tradingName: string | null;
  companyNumber: string;
  corporateType:
    | "limited_company"
    | "llp"
    | "scottish_partnership"
    | "other_corporate";
  corporateStatus: "active";
  sector: string;
  locality: string;
  county: "Kent";
  websiteUrl: string | null;
  googlePlaceId: string | null;
  googleMapsReferenceUrl: string | null;
  firstPartySourceUrl: string;
  verifiedAt: string;
};

export type FirstEmailCandidate = {
  subject: string;
  html: string;
  text: string;
  wordCount: number;
  optOutSentence: string;
  conceptDisclaimer: string;
};

export type EmailVisualCandidate = {
  // Initial ingestion uses the reviewed fallback. Upload the generated visual
  // after the response provides persisted run and prospect IDs.
  assetId: null;
  fallbackAssetKey: string;
  altText: string;
  conceptDisclaimer: string;
};
```

Use `.strict()` for every object so disallowed Maps fields cannot pass silently. The full run schema matches the data contract.

- [ ] **Step 4: Run tests and verify GREEN**

```bash
node --import tsx --test lib/growth/research/ingestion-schema.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -- lib/growth/research
git commit -m "feat: define signed research ingestion contract"
```

### Task 3: Verify Agent Request Signatures

**Files:**

- Create: `lib/growth/integrations/agent-signature.ts`
- Create: `lib/growth/integrations/agent-signature.test.ts`

**Interfaces:**

- Consumes: raw request bytes, timestamp, signature, configured secret
- Produces: `verifyAgentRequest`

- [ ] **Step 1: Write failing signature tests**

Use a fixed secret, body, and time. Cover valid signature, modified body, stale timestamp, future timestamp, invalid hex, missing header, and wrong key ID.

```ts
const result = verifyAgentRequest({
  rawBody: Buffer.from('{"schemaVersion":"1.0"}'),
  keyId: "weekday-agent-v1",
  timestamp: "1786856400",
  signature: validSignature,
  now: new Date("2026-08-16T09:00:00Z"),
  configuredKeyId: "weekday-agent-v1",
  secret: "test-secret",
});

assert.equal(result.ok, true);
```

- [ ] **Step 2: Run tests and verify RED**

```bash
node --import tsx --test lib/growth/integrations/agent-signature.test.ts
```

- [ ] **Step 3: Implement signature verification**

Use HMAC-SHA256 over `timestamp + "." + rawBody`. Compare equal-length buffers with `timingSafeEqual`. Permit at most 300 seconds of clock difference. Return a discriminated result with stable error codes and never log the signature or secret.

```ts
export type AgentSignatureResult =
  | { ok: true }
  | { ok: false; code: "missing" | "key_mismatch" | "stale" | "invalid" };
```

- [ ] **Step 4: Run tests and verify GREEN**

```bash
node --import tsx --test lib/growth/integrations/agent-signature.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -- lib/growth/integrations/agent-signature.ts lib/growth/integrations/agent-signature.test.ts
git commit -m "security: verify signed agent requests"
```

### Task 4: Add Generated Visual Upload And Fallback Library

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `lib/growth/email/assets/service.ts`
- Create: `lib/growth/email/assets/service.test.ts`
- Create: `lib/growth/email/assets/fallbacks.ts`
- Create: `public/growth/email/fallbacks/`
- Create: `app/api/agent/email-assets/route.ts`

**Interfaces:**

- Consumes: signed multipart request and approved fallback configuration
- Produces: `storeEmailAsset`, `resolveEmailAsset`, asset upload route

- [ ] **Step 1: Install image and Blob packages**

```bash
pnpm add @vercel/blob sharp
```

- [ ] **Step 2: Write failing asset tests**

Cover:

- Valid 1200 by 630 image normalises and stores
- EXIF metadata is removed
- Cold visual over 180 KB is compressed or rejected
- Invalid magic bytes are rejected even with an image MIME header
- Aspect ratio outside 1.85 through 1.95 is rejected
- Missing alt text is rejected
- Blob object name contains UUID only, not business or contact data
- Fallback resolution returns the configured sector asset when `assetId` is null

Inject fake Sharp and Blob adapters. Do not make network calls in unit tests.

- [ ] **Step 3: Implement the service**

```ts
export type StoreEmailAssetInput = {
  prospectId: string;
  runId: string;
  bytes: Uint8Array;
  declaredContentType: string;
  altText: string;
  promptSummary: string;
  assetKind: "cold_first_email" | "newsletter" | "site_email";
};

export type StoredEmailAsset = {
  id: string;
  blobUrl: string;
  contentType: "image/webp";
  byteSize: number;
  width: number;
  height: number;
  sha256: string;
  reviewStatus: "pending";
};
```

Normalise to WebP, strip metadata, use an opaque path such as `growth-email-assets/<uuid>.webp`, then insert metadata. Delete the Blob object if the database insert fails.

- [ ] **Step 4: Add approved fallbacks**

Generate and founder-review one visual for each initial sector group: home/property, automotive, professional services, estate agency, and hospitality. Store optimised files in `public/growth/email/fallbacks/` and map stable keys in `fallbacks.ts`.

Every fallback has hard-coded alt text and a checksum test.

- [ ] **Step 5: Add the signed route**

The route must:

1. Read raw multipart bytes under a 512 KB limit.
2. Verify agent signature before parsing the file.
3. Require `runId`, `prospectId`, `altText`, `promptSummary`, and `assetKind`.
4. Verify the referenced run and prospect belong together.
5. Store and return only safe asset metadata.

- [ ] **Step 6: Run tests and build**

```bash
node --import tsx --test lib/growth/email/assets/service.test.ts
pnpm lint
pnpm build
```

- [ ] **Step 7: Commit**

```bash
git add -- package.json pnpm-lock.yaml lib/growth/email/assets public/growth/email/fallbacks app/api/agent/email-assets
git commit -m "feat: add safe generated email visuals"
```

### Task 5: Implement Atomic Research Ingestion

**Files:**

- Create: `lib/growth/research/repository.ts`
- Create: `lib/growth/research/ingest.ts`
- Create: `lib/growth/research/ingest.test.ts`
- Create: `tests/integration/growth/research-ingestion.test.ts`

**Interfaces:**

- Consumes: validated `ResearchRunIngestion`
- Produces: `ingestResearchRun`

- [ ] **Step 1: Write failing service tests**

Cover:

- Valid run inserts run, business, contact, prospect, evidence, assessment, task, and draft atomically
- Duplicate `externalRunId` returns the existing result
- Duplicate company number is counted without a second business
- Suppressed address is rejected before prospect insertion
- Pre-attached custom assets are rejected because persisted IDs do not exist yet
- A post-ingestion cold-email upload atomically selects its canonical asset metadata on the draft
- Any invalid record rolls back the whole run

- [ ] **Step 2: Run tests and verify RED**

```bash
node --import tsx --test lib/growth/research/ingest.test.ts
```

- [ ] **Step 3: Implement the ingestion transaction**

```ts
export async function ingestResearchRun(
  db: GrowthDb,
  input: ResearchRunIngestion,
): Promise<ResearchRunIngestionResult>;
```

Inside one transaction:

1. Lock or return an existing `externalRunId`.
2. Insert `research_runs` as `processing`.
3. Check business company number, contact email, and current suppressions.
4. Insert or match the canonical business.
5. Insert the contact only when its corporate status remains accepted.
6. Insert prospect, evidence, website assessment, and agent-task snapshots.
7. Validate and snapshot the reviewed fallback asset.
8. Insert the first-email draft as an agent-task output for Plan 03 to materialise. The signed asset route may replace the fallback selection only after these run and prospect IDs exist.
9. Update run counts and status to `completed`.
10. Append redacted audit events.

Do not silently fix agent values. Return stable rejection reason codes.

- [ ] **Step 4: Run unit and integration tests**

```bash
node --import tsx --test lib/growth/research/ingest.test.ts
node --import tsx --test tests/integration/growth/research-ingestion.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -- lib/growth/research tests/integration/growth/research-ingestion.test.ts
git commit -m "feat: ingest complete research runs atomically"
```

### Task 6: Add The Signed Research Route

**Files:**

- Create: `app/api/agent/research-runs/route.ts`
- Create: `app/api/agent/research-runs/route.test.ts`
- Create: `lib/growth/http/api-error.ts`

**Interfaces:**

- Consumes: signature verifier, ingestion schema, ingestion service
- Produces: `POST /api/agent/research-runs`

- [ ] **Step 1: Write route orchestration tests**

Use dependency injection for the verifier and service. Cover 401 missing signature, 401 invalid signature, 400 invalid JSON, 422 invalid bundle, 200 accepted, 200 idempotent retry, and 500 safe error.

- [ ] **Step 2: Implement the thin route**

The route reads the raw body once, verifies it, parses JSON, validates with Zod, calls `ingestResearchRun`, and returns the data-contract response. It creates a correlation ID and never logs the raw body.

- [ ] **Step 3: Run the route test**

```bash
node --import tsx --test app/api/agent/research-runs/route.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add -- app/api/agent/research-runs lib/growth/http/api-error.ts
git commit -m "feat: expose signed research ingestion route"
```

### Task 7: Write The Weekday Codex Runbook And Prompt

**Files:**

- Create: `docs/growth-os/runbooks/scheduled-research.md`
- Create: `docs/growth-os/prompts/weekday-research.md`
- Create: `docs/growth-os/fixtures/research-run-v1.json`

**Interfaces:**

- Consumes: ingestion contract and signed endpoint
- Produces: operator-ready scheduled task instructions and safe fixture

- [ ] **Step 1: Write the schedule runbook**

Record:

- Weekdays at 06:00 Europe/London
- Target ten accepted prospects
- Kent business mix from the design spec
- Search, first-party, Companies House, and Maps discovery rules
- Rejection rules and suppression requirement
- Image generation plus fallback behaviour
- Endpoint, signature algorithm, retry limit, and idempotent `externalRunId`
- A dry-run mode that produces the JSON bundle without posting
- A failure report that records counts and reason codes without raw personal data

- [ ] **Step 2: Write the exact scheduled task prompt**

The prompt must instruct Codex to:

```text
Research Kent-based local service companies and produce up to ten new, qualified corporate prospects. Use Google Search and Google Maps only to discover candidates. Verify every accepted business through Companies House and a first-party source. Do not copy or persist Google Maps reviews, photos, ratings, or listing text. Reject sole traders, personal subscribers, uncertain partnerships, suppressed contacts, unverifiable work emails, and duplicates.

For each accepted prospect, prepare a structured website assessment, FSS offer recommendation, complete 140 to 220 word first email, plain-text alternative, direct opt-out sentence, and one non-deceptive conceptual visual. The visual must not fabricate staff, premises, testimonials, reviews, or results. If image generation is unavailable, choose an approved sector fallback key.

Validate the version 1.0 fixture locally, sign the final research bundle, and submit it once. Use the returned accepted-candidate index mapping to upload each valid visual with its persisted run and prospect IDs. If a visual upload is unavailable or fails, retain the approved fallback. Report accepted, duplicate, and rejected counts. Do not send email.
```

- [ ] **Step 3: Add a redacted fixture**

Use fictional companies, `.test` email domains, example URLs, and no live credentials. The fixture must pass the schema test.

- [ ] **Step 4: Run the fixture test and full checks**

```bash
node --import tsx --test lib/growth/research/ingestion-schema.test.ts
pnpm test:growth
pnpm lint
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add -- docs/growth-os/runbooks/scheduled-research.md docs/growth-os/prompts/weekday-research.md docs/growth-os/fixtures/research-run-v1.json
git commit -m "docs: add weekday Codex research runbook"
```
