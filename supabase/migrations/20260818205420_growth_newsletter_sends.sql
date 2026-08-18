-- growth.email_messages is hard-bound to Gmail sequences (sequence_enrollment_id,
-- prospect_id, and contact_id are all not null with a composite FK), so it cannot
-- hold newsletter recipient send-attempt rows. This table is the Resend-side
-- analogue: one row per (newsletter_issue, subscriber) send attempt, dispatched
-- with the same claim/lease/retry pattern as growth.email_messages.

create table growth.newsletter_sends (
  id uuid primary key default gen_random_uuid(),
  newsletter_issue_id uuid not null
    references growth.newsletter_issues(id) on delete restrict,
  subscriber_id uuid not null
    references growth.newsletter_subscribers(id) on delete restrict,
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'retry', 'sent', 'cancelled', 'failed')),
  idempotency_key text not null check (length(trim(idempotency_key)) > 0),
  provider_message_id text,
  lease_token uuid,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text,
  last_error_summary text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint newsletter_send_lease_complete check (
    (lease_token is null and lease_expires_at is null)
    or (lease_token is not null and lease_expires_at is not null)
  ),
  constraint newsletter_send_sent_complete check (
    status <> 'sent' or (provider_message_id is not null and sent_at is not null)
  )
);

create unique index unique_newsletter_send_recipient
  on growth.newsletter_sends (newsletter_issue_id, subscriber_id);

create unique index unique_newsletter_send_idempotency
  on growth.newsletter_sends (idempotency_key);

create unique index unique_newsletter_send_provider_message
  on growth.newsletter_sends (provider_message_id)
  where provider_message_id is not null;

create index newsletter_sends_claimable_idx
  on growth.newsletter_sends (status, lease_expires_at);

revoke all on growth.newsletter_sends from public, anon, authenticated, service_role;

grant select, insert, update on growth.newsletter_sends to growth_app;

-- Founder review state that Task 1's schema had no columns for: the version
-- and content checksum a founder actually tested and approved, so scheduling
-- can detect a stale test/approval against the current row.
alter table growth.newsletter_issues
  add column test_sent_at timestamptz,
  add column test_sent_version integer check (test_sent_version > 0),
  add column approved_at timestamptz,
  add column approved_by text,
  add column approved_checksum text check (approved_checksum ~ '^[0-9a-f]{64}$');
