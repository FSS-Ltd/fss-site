# FSS Growth OS Data, API, And Security Contract

Status: Approved planning contract
Applies to: all Growth OS implementation plans

## System Boundary

The browser talks only to the Next.js application. Vercel server code is the only runtime that talks to PostgreSQL, Gmail, Resend, Vercel Blob, Google OAuth, or the signed Codex ingestion interface.

Supabase is the managed PostgreSQL provider. It is not the application API.

## Database Connections

Use two connection variables with separate purposes:

| Variable              | Use                                                            | Connection mode                                            |
| --------------------- | -------------------------------------------------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`        | Vercel runtime queries                                         | Supavisor transaction pooler, prepared statements disabled |
| `DIRECT_DATABASE_URL` | Migrations, schema inspection, backup, local operator commands | Direct connection or Supavisor session mode                |

The implementation must create a least-privileged `growth_app` role. Runtime credentials can use only the required tables, sequences, and functions in `growth`. Migration credentials are never used by a running function.

## Schema

All tables are in the private `growth` schema. IDs are UUIDs. Timestamps are `timestamptz` in UTC. Human scheduling uses the `Europe/London` IANA timezone and is converted to an absolute UTC timestamp when a message enters a sequence.

Every mutable founder-controlled workflow record has an integer `version` that starts at 1 and increments on each accepted change. Founder mutations compare the submitted version inside the write transaction and return a conflict instead of overwriting a newer decision.

### `businesses`

Purpose: one canonical organisation record.

Required fields:

- `id`
- `legal_name`
- `trading_name`
- `company_number`
- `corporate_type`
- `corporate_status`
- `sector`
- `locality`
- `county`
- `website_url`
- `google_place_id`
- `google_maps_reference_url`
- `first_party_source_url`
- `verified_at`
- `created_at`
- `updated_at`

Constraints and indexes:

- Unique normalised `company_number` when present
- Unique `google_place_id` when present
- Index `(county, sector)`
- Index `(corporate_status, verified_at desc)`
- `county` must equal `Kent` for automated MVP acceptance
- Google Maps fields contain references only, never copied Maps content

### `contacts`

Purpose: business contacts and their permitted use context.

Required fields:

- `id`
- `business_id`
- `first_name`
- `last_name`
- `role_title`
- `email`
- `normalised_email`
- `email_source_url`
- `email_verified_at`
- `subscriber_type`
- `lawful_basis`
- `privacy_notice_version`
- `privacy_notice_sent_at`
- `created_at`
- `updated_at`

Constraints and indexes:

- Unique `normalised_email`
- Foreign key to `businesses` with restricted delete
- `subscriber_type` is `corporate`, `individual`, or `uncertain`
- Automated outreach accepts only `corporate`

### `prospects`

Purpose: commercial qualification and work queue state.

Required fields:

- `id`
- `business_id`
- `primary_contact_id`
- `research_run_id`
- `status`
- `fit_score`
- `opportunity_summary`
- `recommended_offer`
- `estimated_one_off_min_pence`
- `estimated_one_off_max_pence`
- `estimated_monthly_pence`
- `next_action`
- `next_action_due_at`
- `assigned_owner_email`
- `created_at`
- `updated_at`

Status values:

`new`, `researching`, `needs_review`, `ready_for_email_review`, `qualified`, `contacted`, `replied`, `started_talks`, `proposal`, `negotiation`, `won`, `lost`, `rejected`, `suppressed`

Constraints and indexes:

- One active prospect per business
- `fit_score` from 0 through 100
- Currency uses integer pence
- Index `(status, next_action_due_at)`
- Index `(fit_score desc, created_at desc)`

### `research_runs`

Purpose: one scheduled Codex research execution.

Fields:

- `id`
- `external_run_id`
- `run_date`
- `timezone`
- `status`
- `target_count`
- `accepted_count`
- `duplicate_count`
- `rejected_count`
- `prompt_version`
- `started_at`
- `completed_at`
- `error_code`
- `error_summary`
- `created_at`

`external_run_id` is unique and is the top-level ingestion idempotency key.

### `agent_tasks`

Purpose: durable research, redraft, visual, and assessment work units.

Fields:

- `id`
- `research_run_id`
- `prospect_id`
- `task_type`
- `status`
- `input_snapshot`
- `output_snapshot`
- `attempt_count`
- `last_error_code`
- `last_error_summary`
- `run_after`
- `claimed_at`
- `completed_at`
- `idempotency_key`
- `created_at`
- `updated_at`

`idempotency_key` is unique. Snapshots are redacted JSON and cannot contain tokens or raw Gmail reply bodies.

### `source_evidence`

Purpose: traceable claims that the founder can review.

Fields:

- `id`
- `prospect_id`
- `research_run_id`
- `source_type`
- `source_url`
- `external_reference`
- `claim_type`
- `claim_summary`
- `observed_at`
- `verified_at`
- `retention_class`
- `created_at`

Rules:

- No copied Google Maps reviews, photos, rating values, or listing descriptions
- Companies House evidence stores the company number, profile URL, corporate type, and active status
- First-party evidence stores a short factual summary and link, not a full page copy
- Unique `(prospect_id, source_url, claim_type)`

### `website_assessments`

Purpose: structured website strategy and visual concept deliverables.

Fields:

- `id`
- `prospect_id`
- `business_goal`
- `primary_cta`
- `sitemap`
- `homepage_sections`
- `conversion_plan`
- `local_seo_plan`
- `trust_signals`
- `technology_plan`
- `future_opportunities`
- `hero_concept`
- `mobile_fallback`
- `performance_budget`
- `status`
- `reviewed_at`
- `created_at`
- `updated_at`

Structured sections use validated JSON schemas with explicit versions.

### `email_assets`

Purpose: metadata for generated or approved email visuals stored in Vercel Blob.

Fields:

- `id`
- `prospect_id`
- `asset_kind`
- `blob_url`
- `content_type`
- `byte_size`
- `width`
- `height`
- `alt_text`
- `prompt_summary`
- `sha256`
- `review_status`
- `created_by`
- `created_at`
- `reviewed_at`

Constraints:

- Unique `sha256`
- `byte_size` at most 184320 bytes for cold outreach
- Accepted cold-email aspect ratio from 1.85 through 1.95
- Allowed MIME types: `image/webp`, `image/jpeg`, `image/png`
- `review_status` is `pending`, `approved`, `rejected`, or `fallback`
- Blob object names use UUIDs and contain no contact email or personal name

### `email_templates`

Purpose: versioned Gmail follow-up and Resend template definitions.

Fields:

- `id`
- `channel`
- `template_key`
- `version`
- `status`
- `subject_template`
- `html_template`
- `text_template`
- `required_fields`
- `image_policy`
- `checksum`
- `published_by`
- `published_at`
- `created_at`

Unique `(channel, template_key, version)`. Published templates are immutable. A change creates a new version.

### `sequence_enrollments`

Purpose: one prospect's approved outreach sequence.

Fields:

- `id`
- `prospect_id`
- `contact_id`
- `status`
- `current_step`
- `template_snapshot`
- `first_message_id`
- `gmail_thread_id`
- `started_at`
- `stopped_at`
- `stop_reason`
- `created_at`
- `updated_at`

Status values:

`pending_approval`, `active`, `paused`, `stopped_reply`, `stopped_opt_out`, `stopped_bounce`, `stopped_rejected`, `stopped_started_talks`, `completed`

Only `active` can produce a due message.

### `email_messages`

Purpose: provider-neutral message intent, immutable content snapshot, and send state.

Fields:

- `id`
- `sequence_enrollment_id`
- `prospect_id`
- `contact_id`
- `channel`
- `direction`
- `step_number`
- `status`
- `subject_snapshot`
- `html_snapshot`
- `text_snapshot`
- `email_asset_id`
- `provider_message_id`
- `provider_thread_id`
- `provider_draft_id`
- `rfc_message_id`
- `idempotency_key`
- `scheduled_for`
- `lease_token`
- `lease_expires_at`
- `attempt_count`
- `last_error_code`
- `last_error_summary`
- `sent_at`
- `received_at`
- `created_at`
- `updated_at`

Constraints and indexes:

- Unique `idempotency_key`
- Unique `rfc_message_id`
- Unique provider identifier within each channel when present
- Index `(status, scheduled_for)`
- Index `(provider_thread_id, received_at desc)`
- A sent content snapshot is immutable

### `email_events`

Purpose: provider and internal state events.

Fields:

- `id`
- `email_message_id`
- `provider`
- `provider_event_id`
- `event_type`
- `occurred_at`
- `sanitised_payload`
- `created_at`

Unique `(provider, provider_event_id)`. The payload excludes tokens and raw message bodies.

### `suppressions`

Purpose: global send prevention.

Fields:

- `id`
- `normalised_email`
- `business_id`
- `reason`
- `source`
- `created_at`
- `created_by`

Unique `normalised_email`. Deletion is not exposed through normal application services.

### `inbound_leads`

Purpose: public website enquiry and resource requests stored in PostgreSQL.

Fields:

- `id`
- `submission_id`
- `submission_type`
- `first_name`
- `last_name`
- `work_email`
- `business_name`
- `challenge`
- `source_path`
- `source_context`
- `resource_slug`
- `newsletter_opt_in`
- `consent_text_version`
- `submitted_at`
- `created_at`

Unique submission idempotency keys are stored with the record. Public API responses do not reveal whether an address already exists.

### `newsletter_subscribers`

Purpose: consent and subscription state.

Fields:

- `id`
- `email`
- `normalised_email`
- `first_name`
- `business_name`
- `status`
- `consent_source`
- `consent_text_version`
- `consent_evidence`
- `consent_ip_hash`
- `consent_user_agent_hash`
- `consented_at`
- `unsubscribed_at`
- `resend_contact_id`
- `created_at`
- `updated_at`

Unique `normalised_email`. Status is `pending`, `subscribed`, `unsubscribed`, `bounced`, or `complained`.

### `newsletter_issues`

Purpose: reviewed newsletter content and send state.

Fields:

- `id`
- `issue_key`
- `version`
- `status`
- `subject`
- `preview_text`
- `html_snapshot`
- `text_snapshot`
- `email_asset_id`
- `audience_snapshot`
- `scheduled_for`
- `sent_at`
- `created_by`
- `created_at`
- `updated_at`

Unique `(issue_key, version)`. Published versions are immutable.

Status is `draft`, `ready_for_review`, `approved`, `scheduled`, `sending`, `sent`, `failed`, or `cancelled`. A new content edit after approval creates a new version.

### `delivery_engagements`

Purpose: pipeline, deal, client, and delivery state without duplicating one opportunity across separate systems.

Fields:

- `id`
- `prospect_id`
- `version`
- `stage`
- `name`
- `one_off_value_pence`
- `monthly_value_pence`
- `probability_percent`
- `expected_close_date`
- `won_at`
- `lost_at`
- `loss_reason`
- `delivery_status`
- `delivery_start_date`
- `delivery_target_date`
- `newsletter_invited_at`
- `created_at`
- `updated_at`

Stage values: `new`, `qualified`, `proposal`, `negotiation`, `won`, `lost`. Delivery values: `not_started`, `discovery`, `build`, `review`, `complete`, `support`, `cancelled`.

Each prospect has at most one engagement. A later opportunity for the same business uses a new historical prospect and engagement, preserving the earlier commercial record.

### `commercial_stage_events`

Purpose: append-only history for commercial and delivery transitions.

Fields:

- `id`
- `engagement_id`
- `dimension`
- `from_state`
- `to_state`
- `reason_code`
- `actor_type`
- `actor_id`
- `correlation_id`
- `occurred_at`

`dimension` is `commercial` or `delivery`. Application roles receive insert and select only. The transition transaction locks the engagement, verifies the current state and version, updates the engagement, inserts one stage event, and appends one audit event.

### `integration_connections`

Purpose: provider connection state and encrypted tokens.

Fields:

- `id`
- `provider`
- `subject_email`
- `encrypted_refresh_token`
- `encryption_key_version`
- `granted_scopes`
- `access_token_expires_at`
- `provider_cursor`
- `status`
- `last_synced_at`
- `last_error_code`
- `created_at`
- `updated_at`

Unique `(provider, subject_email)`. Token values are never selected by dashboard read models.

### `audit_log`

Purpose: append-only record of sensitive actions.

Fields:

- `id`
- `correlation_id`
- `actor_type`
- `actor_id`
- `action`
- `entity_type`
- `entity_id`
- `metadata`
- `created_at`

Application roles receive INSERT and SELECT only. Update and delete are revoked.

## State Invariants

### Prospect Ready For Review

A prospect can enter `ready_for_email_review` only when:

- Corporate subscriber status is verified
- Primary contact has a verified work address and source URL
- Suppression check passes
- Evidence schema passes
- First-email HTML and plain-text snapshots pass copy checks
- One approved or fallback email asset is attached
- Alt text and conceptual-image disclaimer are present

### Approve And Send

One transaction must:

1. Lock the prospect and draft message.
2. Recheck suppression and corporate status.
3. Snapshot the selected template and rendered content.
4. Create the sequence enrollment.
5. Mark the first message `queued` with a deterministic idempotency key and RFC Message-ID.
6. Append the approval audit event.

The provider send happens after this transaction. A successful provider response updates the message and schedules later steps.

Follow-up labels Day 5, Day 11, and Day 20 use calendar offsets of 4, 10, and 19 days from the actual first-send timestamp. Each target is scheduled for 10:00 `Europe/London`. A Saturday or Sunday target moves forward to Monday before conversion to UTC. The MVP does not claim UK bank-holiday awareness.

### Stop Wins

Every stop transition is monotonic. Once stopped, an enrollment cannot return to active. A new sequence requires a new founder approval and a new enrollment.

Before every send, the dispatcher checks:

- Enrollment status is active
- No suppression exists
- Prospect is not replied, started talks, rejected, lost, won, or suppressed
- Gmail reply cursor is current within the permitted freshness window
- Required merge data still exists

## API Contracts

All API error bodies use:

```ts
type ApiError = {
  ok: false;
  code: string;
  message: string;
  correlationId: string;
};
```

User-facing messages are safe and generic. Logs use the correlation ID, not raw payloads.

### `POST /api/agent/research-runs`

Authentication headers:

- `X-FSS-Key-Id`
- `X-FSS-Timestamp`
- `X-FSS-Signature`

Signature input is `timestamp + "." + rawBody`. Use HMAC-SHA256 and timing-safe comparison. Reject timestamps outside five minutes.

Request:

```ts
type ResearchRunIngestion = {
  schemaVersion: "1.0";
  externalRunId: string;
  runDate: string;
  timezone: "Europe/London";
  promptVersion: string;
  prospects: Array<{
    business: BusinessCandidate;
    contact: ContactCandidate;
    evidence: EvidenceCandidate[];
    assessment: WebsiteAssessmentCandidate;
    firstEmail: FirstEmailCandidate;
    visual: EmailVisualCandidate;
  }>;
  rejections: Array<{
    candidateName: string;
    reasonCode: string;
    sourceUrl?: string;
  }>;
};
```

Response:

```ts
type ResearchRunIngestionResult = {
  ok: true;
  runId: string;
  accepted: number;
  duplicates: number;
  rejected: number;
  acceptedProspects: Array<{
    candidateIndex: number;
    prospectId: string;
  }>;
};
```

The full bundle inserts atomically. A retry with the same `externalRunId` returns the existing result.

### `POST /api/agent/email-assets`

Accept one multipart asset per call plus JSON metadata. Maximum request size is 512 KB. Validate signature, MIME type, magic bytes, dimensions, size, checksum, alt text, and prospect/run ownership before upload.

Response returns `assetId`, stable `blobUrl`, checksum, size, and validation state.

### Founder Actions

- `POST /api/growth/prospects/:id/research-request`
- `POST /api/growth/messages/:id/needs-redraft`
- `POST /api/growth/messages/:id/create-gmail-draft`
- `POST /api/growth/messages/:id/approve-send`
- `POST /api/growth/sequences/:id/pause`
- `POST /api/growth/sequences/:id/started-talks`
- `POST /api/growth/sequences/:id/reject`
- `POST /api/growth/sequences/:id/do-not-contact`
- `POST /api/growth/newsletters/:id/send-test`
- `POST /api/growth/newsletters/:id/approve-schedule`
- `POST /api/growth/templates/:id/publish`

Each route requires the founder session, an anti-CSRF origin check, Zod input validation, a current entity version for optimistic concurrency, and an audit event.

### Provider Webhooks And Cron

- `POST /api/webhooks/resend`
- `GET /api/cron/gmail-sync`
- `GET /api/cron/outreach-dispatch`
- `GET /api/cron/maintenance`

Resend uses provider signature verification before parsing business data. Cron routes require exact bearer equality with `CRON_SECRET` and return no sensitive data.

## Environment Variables

### Shared Server-Only

- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `AUTH_SECRET`
- `GROWTH_OS_OWNER_EMAIL`
- `TOKEN_ENCRYPTION_KEY`
- `CRON_SECRET`
- `GROWTH_OS_AUTOMATIONS_ENABLED`

### Dashboard OAuth

- `GOOGLE_AUTH_CLIENT_ID`
- `GOOGLE_AUTH_CLIENT_SECRET`

### Gmail Automation OAuth

- `GOOGLE_GMAIL_CLIENT_ID`
- `GOOGLE_GMAIL_CLIENT_SECRET`
- `GOOGLE_GMAIL_REDIRECT_URI`

### Agent Ingestion

- `AGENT_INGEST_KEY_ID`
- `AGENT_INGEST_SECRET`

### Email And Blob

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO_EMAIL`
- `RESEND_WEBHOOK_SECRET`
- `BLOB_READ_WRITE_TOKEN`

No secret variable uses the `NEXT_PUBLIC_` prefix.

## Security Verification Matrix

| Control                | Automated verification                                                       |
| ---------------------- | ---------------------------------------------------------------------------- |
| Founder allowlist      | Auth callback and protected-route tests reject every other email             |
| Private database       | Migration assertion confirms schema exposure and grants                      |
| SQL injection          | Repositories use parameters; malicious input integration tests               |
| Ingestion forgery      | Bad key, stale timestamp, modified body, and replay tests                    |
| Cron forgery           | Missing and incorrect bearer tests                                           |
| OAuth CSRF             | State mismatch test                                                          |
| Token secrecy          | Log redaction test and repository read-model test                            |
| Suppression            | Every sender test includes a suppressed-address case                         |
| Sequence stop          | Reply and manual stop race tests                                             |
| Duplicate send         | Repeated claim and provider-timeout reconciliation tests                     |
| Webhook replay         | Duplicate provider event test                                                |
| Generated image safety | MIME, dimensions, size, alt text, disclaimer, and ownership tests            |
| Marketing consent      | Newsletter service rejects absent, withdrawn, bounced, or complained consent |
