-- Studio settings are append-only operational drafts. They never alter a
-- provider, sender credential, feature flag, approved template or live
-- approval snapshot.
create table operations.studio_settings_drafts (
  id uuid primary key default gen_random_uuid(),
  revision integer not null check (revision > 0),
  display_name text not null check (length(trim(display_name)) between 1 and 160),
  reply_to text check (reply_to is null or (reply_to = lower(trim(reply_to)) and length(reply_to) between 3 and 254)),
  timezone text not null check (length(trim(timezone)) between 1 and 100),
  response_expectation_hours integer not null check (response_expectation_hours between 1 and 168),
  delivery_capacity text not null check (delivery_capacity in ('standard', 'limited', 'priority')),
  created_by text not null check (created_by ~ '^[a-f0-9]{64}$'),
  correlation_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (revision)
);

alter table operations.studio_settings_drafts enable row level security;
alter table operations.studio_settings_drafts force row level security;

create policy founder_read on operations.studio_settings_drafts
  for select to operations_founder
  using (current_setting('operations.actor_id', true) ~ '^[a-f0-9]{64}$');

create policy founder_insert on operations.studio_settings_drafts
  for insert to operations_founder
  with check (
    created_by = current_setting('operations.actor_id', true)
    and created_by ~ '^[a-f0-9]{64}$'
  );

grant select, insert on operations.studio_settings_drafts to operations_founder;
revoke all on operations.studio_settings_drafts
  from public, anon, authenticated, service_role, growth_app, operations_portal,
    operations_billing_worker, operations_signing_worker, operations_onboarding_worker;
