-- growth.email_events has a NOT NULL foreign key to growth.email_messages(id),
-- but no Resend-sent email in this codebase reliably has an email_messages row:
-- lead-submission emails are sent with no DB row, and newsletter sends live in
-- growth.newsletter_sends, a different table email_events cannot reference.
-- This table is the idempotent Resend webhook event log that both cases need,
-- with both FKs nullable so suppression can apply purely from the recipient
-- email even with zero local match.

create table growth.resend_delivery_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null check (length(trim(provider_event_id)) > 0),
  event_type text not null check (length(trim(event_type)) > 0),
  occurred_at timestamptz not null,
  recipient_normalised_email text not null check (
    recipient_normalised_email = lower(trim(recipient_normalised_email))
    and recipient_normalised_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  email_message_id uuid
    references growth.email_messages(id) on delete restrict,
  newsletter_send_id uuid
    references growth.newsletter_sends(id) on delete restrict,
  sanitised_payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(sanitised_payload) = 'object'),
  created_at timestamptz not null default now(),
  constraint resend_delivery_event_single_reference check (
    email_message_id is null or newsletter_send_id is null
  )
);

create unique index unique_resend_delivery_event
  on growth.resend_delivery_events (provider_event_id);

create index resend_delivery_events_recipient_idx
  on growth.resend_delivery_events (recipient_normalised_email);

create index resend_delivery_events_email_message_id_idx
  on growth.resend_delivery_events (email_message_id)
  where email_message_id is not null;

create index resend_delivery_events_newsletter_send_id_idx
  on growth.resend_delivery_events (newsletter_send_id)
  where newsletter_send_id is not null;

revoke all on growth.resend_delivery_events from public, anon, authenticated, service_role;

grant select, insert on growth.resend_delivery_events to growth_app;
