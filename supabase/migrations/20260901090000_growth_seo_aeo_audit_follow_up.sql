-- The second follow-up is an individual SEO/AEO audit, not a shared template.
-- A founder must approve each rendered audit email before it enters the queue.

create table growth.seo_audit_drafts (
  id uuid primary key default gen_random_uuid(),
  sequence_enrollment_id uuid not null
    references growth.sequence_enrollments(id) on delete restrict,
  prospect_id uuid not null
    references growth.prospects(id) on delete restrict,
  status text not null check (status in ('claimed', 'draft', 'approved', 'cancelled')),
  claim_expires_at timestamptz,
  output_snapshot jsonb
    check (output_snapshot is null or jsonb_typeof(output_snapshot) = 'object'),
  report_url text,
  report_sha256 text
    check (report_sha256 is null or report_sha256 ~ '^[a-f0-9]{64}$'),
  completed_at timestamptz,
  approved_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seo_audit_drafts_sequence_unique unique (sequence_enrollment_id),
  constraint seo_audit_drafts_claim_metadata check (
    status <> 'claimed'
    or (claim_expires_at is not null and output_snapshot is null and report_url is null)
  ),
  constraint seo_audit_drafts_completed_metadata check (
    status not in ('draft', 'approved')
    or (
      output_snapshot is not null
      and report_url is not null
      and report_sha256 is not null
      and completed_at is not null
    )
  ),
  constraint seo_audit_drafts_approved_metadata check (
    status <> 'approved' or approved_at is not null
  )
);

create index seo_audit_drafts_status_claim_idx
  on growth.seo_audit_drafts (status, claim_expires_at);

create index seo_audit_drafts_prospect_created_idx
  on growth.seo_audit_drafts (prospect_id, created_at desc);

revoke all on growth.seo_audit_drafts
  from public, anon, authenticated, service_role;

grant select, insert, update on growth.seo_audit_drafts to growth_app;

-- Prevent any already-queued generic Day 11 messages from bypassing the new
-- founder approval. Messages already sent remain immutable and untouched.
update growth.email_messages
set status = 'cancelled',
    last_error_code = 'replaced_by_seo_audit_review',
    last_error_summary = 'Replaced by the founder-approved SEO and AEO audit follow-up.',
    updated_at = now()
where direction = 'outbound'
  and step_number = 2
  and status in ('queued', 'retry');

-- Move unsent close-the-loop messages from the previous Day 20 cadence to
-- Day 14, preserving the 10:00 Europe/London weekday scheduling rule.
with first_sends as (
  select distinct on (sequence_enrollment_id)
    sequence_enrollment_id,
    sent_at
  from growth.email_messages
  where direction = 'outbound'
    and step_number = 0
    and status = 'sent'
    and sent_at is not null
  order by sequence_enrollment_id, sent_at asc
),
day_14_dates as (
  select
    sequence_enrollment_id,
    ((sent_at at time zone 'Europe/London')::date + 13) as target_date
  from first_sends
)
update growth.email_messages close_out
set scheduled_for = (
  (
    case extract(isodow from day_14_dates.target_date)
      when 6 then day_14_dates.target_date + 2
      when 7 then day_14_dates.target_date + 1
      else day_14_dates.target_date
    end + time '10:00'
  ) at time zone 'Europe/London'
),
updated_at = now()
from day_14_dates
where close_out.sequence_enrollment_id = day_14_dates.sequence_enrollment_id
  and close_out.direction = 'outbound'
  and close_out.step_number = 3
  and close_out.status in ('queued', 'retry');
