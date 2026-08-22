-- Task 5 of Plan 06 (FSS Growth OS Pipeline And Delivery): the client
-- delivery thank-you is a single-recipient Resend message, distinct from
-- growth.email_messages (FK-bound to a cold-outreach sequence enrollment)
-- and growth.newsletter_issues (multi-recipient, audience-resolved at
-- dispatch). One engagement gets at most one thank-you row, created once by
-- the first transition to delivery_status 'complete' (see
-- unique_client_message_engagement below); it starts pending_approval and
-- is never re-rendered once sent.

create table growth.client_messages (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null
    references growth.delivery_engagements(id) on delete restrict,
  version integer not null default 1 check (version > 0),
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'sent')),
  template_key text not null check (length(trim(template_key)) > 0),
  included_newsletter_invite boolean not null default false,
  recipient_contact_id uuid not null
    references growth.contacts(id) on delete restrict,
  subject_snapshot text not null check (length(trim(subject_snapshot)) > 0),
  html_snapshot text not null check (length(trim(html_snapshot)) > 0),
  text_snapshot text not null check (length(trim(text_snapshot)) > 0),
  checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
  test_sent_at timestamptz,
  test_sent_version integer,
  provider_message_id text,
  sent_at timestamptz,
  created_by text not null check (length(trim(created_by)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_message_sent_requires_provider_id check (
    status <> 'sent'
    or (provider_message_id is not null and sent_at is not null)
  )
);

create unique index unique_client_message_engagement
  on growth.client_messages (engagement_id);

create unique index unique_client_message_provider_message
  on growth.client_messages (provider_message_id)
  where provider_message_id is not null;

create index client_messages_status_idx
  on growth.client_messages (status, created_at desc);

create function growth.reject_sent_client_message_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'sent' and new is distinct from old then
    raise exception 'a sent client message is immutable'
      using errcode = '23514';
  end if;

  return new;
end
$$;

create trigger reject_sent_client_message_update
before update on growth.client_messages
for each row
execute function growth.reject_sent_client_message_update();

revoke all on growth.client_messages from public, anon, authenticated, service_role;

revoke all on function growth.reject_sent_client_message_update()
from public, anon, authenticated, service_role;

grant select, insert, update on growth.client_messages to growth_app;
