create table growth.email_templates (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('gmail', 'resend')),
  template_key text not null check (length(trim(template_key)) > 0),
  version text not null check (length(trim(version)) > 0),
  status text not null check (status in ('draft', 'published', 'retired')),
  subject_template text,
  html_template text not null check (length(trim(html_template)) > 0),
  text_template text not null check (length(trim(text_template)) > 0),
  required_fields text[] not null default '{}',
  image_policy jsonb not null default '{}'::jsonb
    check (jsonb_typeof(image_policy) = 'object'),
  checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
  published_by text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  constraint published_email_template_metadata check (
    status <> 'published'
    or (published_by is not null and published_at is not null)
  )
);

create unique index unique_template_version
  on growth.email_templates (channel, template_key, version);

alter table growth.prospects
  add constraint prospects_id_primary_contact_id_unique
  unique (id, primary_contact_id);

alter table growth.email_assets
  add constraint email_assets_id_prospect_id_unique
  unique (id, prospect_id);

create table growth.sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null,
  contact_id uuid not null,
  status text not null check (
    status in (
      'pending_approval',
      'active',
      'paused',
      'stopped_reply',
      'stopped_opt_out',
      'stopped_bounce',
      'stopped_rejected',
      'stopped_started_talks',
      'completed'
    )
  ),
  current_step smallint not null default 0 check (current_step >= 0),
  template_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(template_snapshot) = 'object'),
  first_message_id uuid,
  gmail_thread_id text,
  started_at timestamptz,
  stopped_at timestamptz,
  stop_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sequence_enrollments_prospect_contact_fkey
    foreign key (prospect_id, contact_id)
    references growth.prospects(id, primary_contact_id)
    on delete restrict,
  constraint sequence_enrollments_identity_unique
    unique (id, prospect_id, contact_id)
);

create index sequence_enrollments_prospect_id_idx
  on growth.sequence_enrollments (prospect_id);

create index sequence_enrollments_contact_id_idx
  on growth.sequence_enrollments (contact_id);

create index sequence_enrollments_status_idx
  on growth.sequence_enrollments (status);

create table growth.email_messages (
  id uuid primary key default gen_random_uuid(),
  sequence_enrollment_id uuid not null,
  prospect_id uuid not null,
  contact_id uuid not null,
  channel text not null check (channel in ('gmail', 'resend')),
  direction text not null check (direction in ('inbound', 'outbound')),
  step_number smallint not null check (step_number >= 0),
  status text not null check (
    status in (
      'draft',
      'provider_draft',
      'queued',
      'sending',
      'retry',
      'sent',
      'received',
      'cancelled',
      'failed'
    )
  ),
  subject_snapshot text,
  html_snapshot text,
  text_snapshot text,
  email_asset_id uuid,
  provider_message_id text,
  provider_thread_id text,
  provider_draft_id text,
  rfc_message_id text,
  idempotency_key text not null check (length(trim(idempotency_key)) > 0),
  scheduled_for timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text,
  last_error_summary text,
  sent_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_messages_enrollment_identity_fkey
    foreign key (
      sequence_enrollment_id,
      prospect_id,
      contact_id
    )
    references growth.sequence_enrollments(id, prospect_id, contact_id)
    on delete restrict,
  constraint email_messages_asset_prospect_fkey
    foreign key (email_asset_id, prospect_id)
    references growth.email_assets(id, prospect_id)
    on delete restrict,
  constraint email_messages_enrollment_unique
    unique (id, sequence_enrollment_id),
  constraint outbound_sent_message_complete check (
    direction <> 'outbound'
    or status <> 'sent'
    or (
      subject_snapshot is not null
      and html_snapshot is not null
      and text_snapshot is not null
      and rfc_message_id is not null
      and sent_at is not null
    )
  ),
  constraint inbound_message_body_not_stored check (
    direction <> 'inbound'
    or (html_snapshot is null and text_snapshot is null)
  ),
  constraint email_message_lease_complete check (
    (lease_token is null and lease_expires_at is null)
    or (lease_token is not null and lease_expires_at is not null)
  )
);

create unique index unique_message_idempotency
  on growth.email_messages (idempotency_key);

create unique index unique_rfc_message_id
  on growth.email_messages (rfc_message_id);

create unique index unique_provider_message
  on growth.email_messages (channel, provider_message_id)
  where provider_message_id is not null;

create index due_email_messages
  on growth.email_messages (scheduled_for)
  where status in ('queued', 'retry');

create index email_messages_status_scheduled_idx
  on growth.email_messages (status, scheduled_for);

create index email_messages_provider_thread_received_idx
  on growth.email_messages (provider_thread_id, received_at desc);

create index email_messages_sequence_enrollment_id_idx
  on growth.email_messages (sequence_enrollment_id);

create index email_messages_prospect_id_idx
  on growth.email_messages (prospect_id);

create index email_messages_contact_id_idx
  on growth.email_messages (contact_id);

create index email_messages_email_asset_id_idx
  on growth.email_messages (email_asset_id)
  where email_asset_id is not null;

alter table growth.sequence_enrollments
  add constraint sequence_enrollments_first_message_id_fkey
  foreign key (first_message_id, id)
  references growth.email_messages(id, sequence_enrollment_id)
  on delete restrict;

create index sequence_enrollments_first_message_id_idx
  on growth.sequence_enrollments (first_message_id)
  where first_message_id is not null;

create table growth.email_events (
  id uuid primary key default gen_random_uuid(),
  email_message_id uuid not null
    references growth.email_messages(id) on delete restrict,
  provider text not null check (provider in ('gmail', 'resend', 'system')),
  provider_event_id text not null check (length(trim(provider_event_id)) > 0),
  event_type text not null check (length(trim(event_type)) > 0),
  occurred_at timestamptz not null,
  sanitised_payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(sanitised_payload) = 'object'),
  created_at timestamptz not null default now()
);

create unique index unique_provider_event
  on growth.email_events (provider, provider_event_id);

create index email_events_email_message_id_idx
  on growth.email_events (email_message_id);

create index email_events_occurred_at_idx
  on growth.email_events (occurred_at desc);

create table growth.suppressions (
  id uuid primary key default gen_random_uuid(),
  normalised_email text not null check (
    normalised_email = lower(trim(normalised_email))
    and normalised_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  business_id uuid
    references growth.businesses(id) on delete restrict,
  reason text not null check (length(trim(reason)) > 0),
  source text not null check (length(trim(source)) > 0),
  created_at timestamptz not null default now(),
  created_by text not null check (length(trim(created_by)) > 0)
);

create unique index unique_suppression_email
  on growth.suppressions (normalised_email);

create index suppressions_business_id_idx
  on growth.suppressions (business_id)
  where business_id is not null;

create function growth.reject_sent_email_content_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.sent_at is not null and (
    new.subject_snapshot is distinct from old.subject_snapshot
    or new.html_snapshot is distinct from old.html_snapshot
    or new.text_snapshot is distinct from old.text_snapshot
    or new.email_asset_id is distinct from old.email_asset_id
    or new.rfc_message_id is distinct from old.rfc_message_id
    or new.sent_at is distinct from old.sent_at
  ) then
    raise exception 'sent email content is immutable'
      using errcode = '23514';
  end if;

  return new;
end
$$;

create trigger reject_sent_email_content_update
before update on growth.email_messages
for each row
execute function growth.reject_sent_email_content_update();

create function growth.reject_stopped_sequence_reactivation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in (
    'stopped_reply',
    'stopped_opt_out',
    'stopped_bounce',
    'stopped_rejected',
    'stopped_started_talks',
    'completed'
  ) and new.status is distinct from old.status then
    raise exception 'stopped sequence cannot be reactivated'
      using errcode = '23514';
  end if;

  return new;
end
$$;

create trigger reject_stopped_sequence_reactivation
before update on growth.sequence_enrollments
for each row
execute function growth.reject_stopped_sequence_reactivation();

create function growth.reject_published_email_template_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' and new is distinct from old then
    raise exception 'published email templates are immutable'
      using errcode = '23514';
  end if;

  return new;
end
$$;

create trigger reject_published_email_template_update
before update on growth.email_templates
for each row
execute function growth.reject_published_email_template_update();

with follow_up_templates (
  template_key,
  html_template,
  text_template
) as (
  values
    (
      'gmail_follow_up_day_5',
      $day5_html$<p>Hi {{firstName}},</p>
<p>I wanted to bring this back to the top of your inbox.</p>
<p>The practical starting point for {{businessName}} would be a focused enquiry journey, not a large website project. It would collect the details your team needs before the first call and keep the response personal.</p>
<p>Would it be useful if I outlined the smallest version worth building?</p>
<p>Jean-Fidele</p>$day5_html$,
      $day5_text$Hi {{firstName}},

I wanted to bring this back to the top of your inbox.

The practical starting point for {{businessName}} would be a focused enquiry journey, not a large website project. It would collect the details your team needs before the first call and keep the response personal.

Would it be useful if I outlined the smallest version worth building?

Jean-Fidele$day5_text$
    ),
    (
      'gmail_follow_up_day_11',
      $day11_html$<p>Hi {{firstName}},</p>
<p>One useful way to test this idea is to look at the information your team asks for on almost every first call.</p>
<p>If a customer can provide the job type, location, urgency and preferred contact method in advance, the call starts with context rather than repetition. That is the type of practical improvement FSS would design around {{businessName}}.</p>
<p>If you would like, I can send a one-page outline of that flow.</p>
<p>Jean-Fidele</p>$day11_html$,
      $day11_text$Hi {{firstName}},

One useful way to test this idea is to look at the information your team asks for on almost every first call.

If a customer can provide the job type, location, urgency and preferred contact method in advance, the call starts with context rather than repetition. That is the type of practical improvement FSS would design around {{businessName}}.

If you would like, I can send a one-page outline of that flow.

Jean-Fidele$day11_text$
    ),
    (
      'gmail_follow_up_day_20',
      $day20_html$<p>Hi {{firstName}},</p>
<p>I will close the loop after this message.</p>
<p>I contacted you because I saw a practical opportunity to make enquiries easier for customers and clearer for the team at {{businessName}}. If that becomes a priority later, you are welcome to reply to this thread.</p>
<p>Jean-Fidele<br>Faithful Software Solutions</p>$day20_html$,
      $day20_text$Hi {{firstName}},

I will close the loop after this message.

I contacted you because I saw a practical opportunity to make enquiries easier for customers and clearer for the team at {{businessName}}. If that becomes a priority later, you are welcome to reply to this thread.

Jean-Fidele
Faithful Software Solutions$day20_text$
    )
)
insert into growth.email_templates (
  channel,
  template_key,
  version,
  status,
  subject_template,
  html_template,
  text_template,
  required_fields,
  image_policy,
  checksum,
  published_by,
  published_at
)
select
  'gmail',
  template_key,
  '1.0',
  'published',
  null,
  html_template,
  text_template,
  array['firstName', 'businessName'],
  '{"kind":"none"}'::jsonb,
  encode(
    digest(
      convert_to(E'\n' || html_template || E'\n' || text_template, 'UTF8'),
      'sha256'
    ),
    'hex'
  ),
  'system:growth_gmail_outreach_migration',
  now()
from follow_up_templates;

revoke all on
  growth.email_templates,
  growth.sequence_enrollments,
  growth.email_messages,
  growth.email_events,
  growth.suppressions
from public, anon, authenticated, service_role;

revoke all on function
  growth.reject_sent_email_content_update(),
  growth.reject_stopped_sequence_reactivation(),
  growth.reject_published_email_template_update()
from public, anon, authenticated, service_role;

grant select, insert, update on
  growth.email_templates,
  growth.sequence_enrollments,
  growth.email_messages,
  growth.email_events
to growth_app;

grant select, insert on growth.suppressions to growth_app;

revoke update on growth.suppressions from growth_app;
revoke delete on growth.suppressions from growth_app;
