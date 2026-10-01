-- Active presentation settings are deliberately separate from historical drafts.
-- No draft is promoted. Revision zero defaults remain in the application/read function.
create table operations.studio_settings_active (
  revision integer primary key check (revision > 0),
  display_name text not null check (length(trim(display_name)) between 1 and 160),
  reply_to text check (reply_to is null or (reply_to = lower(trim(reply_to)) and length(reply_to) between 3 and 254)),
  timezone text not null check (length(trim(timezone)) between 1 and 100),
  response_expectation_hours integer not null check (response_expectation_hours between 1 and 168),
  delivery_capacity text not null check (delivery_capacity in ('standard', 'limited', 'priority')),
  applied_by text not null check (applied_by ~ '^[a-f0-9]{64}$'),
  correlation_id uuid not null,
  applied_at timestamptz not null default clock_timestamp()
);
create table operations.studio_settings_audit (
  revision integer primary key references operations.studio_settings_active(revision) on delete restrict,
  section text not null check (section in ('identity', 'communication', 'timezone', 'delivery')),
  actor_id text not null check (actor_id ~ '^[a-f0-9]{64}$'),
  correlation_id uuid not null,
  previous_settings jsonb not null check (jsonb_typeof(previous_settings) = 'object'),
  applied_settings jsonb not null check (jsonb_typeof(applied_settings) = 'object'),
  occurred_at timestamptz not null default clock_timestamp()
);

create function operations.studio_settings_staff_authorized() returns boolean
language plpgsql set search_path = '' as $$
begin
  if current_setting('role', true) <> 'operations_founder'
    or coalesce(current_setting('operations.actor_id', true), '') !~ '^[a-f0-9]{64}$'
  then return false; end if;
  perform operations.assert_active_staff_membership();
  return true;
end;
$$;

alter table operations.studio_settings_active enable row level security;
alter table operations.studio_settings_active force row level security;
alter table operations.studio_settings_audit enable row level security;
alter table operations.studio_settings_audit force row level security;
create policy staff_read on operations.studio_settings_active
  for select to operations_founder using (operations.studio_settings_staff_authorized());
create policy staff_apply on operations.studio_settings_active
  for insert to operations_founder with check (
    operations.studio_settings_staff_authorized()
    and applied_by = current_setting('operations.actor_id', true)
  );
create policy staff_read on operations.studio_settings_audit
  for select to operations_founder using (operations.studio_settings_staff_authorized());
create policy staff_record on operations.studio_settings_audit
  for insert to operations_founder with check (
    operations.studio_settings_staff_authorized()
    and actor_id = current_setting('operations.actor_id', true)
  );

revoke all on operations.studio_settings_active, operations.studio_settings_audit
  from public, anon, authenticated, service_role, growth_app, operations_founder,
    operations_portal, operations_billing_worker, operations_signing_worker, operations_onboarding_worker;
grant select, insert on operations.studio_settings_active, operations.studio_settings_audit to operations_founder;
revoke all on function operations.studio_settings_staff_authorized()
  from public, anon, authenticated, service_role, growth_app, operations_founder,
    operations_portal, operations_billing_worker, operations_signing_worker, operations_onboarding_worker;
grant execute on function operations.studio_settings_staff_authorized() to operations_founder;

-- Client realms see only nonsecret presentation values, after a tenant membership check.
-- There are no raw table grants to clients or workers, and no reply-to/capacity exposure.
create function operations.portal_studio_presentation_settings(target_organisation uuid)
returns table(revision integer, display_name text, timezone text, response_expectation_hours integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if current_setting('role', true) <> 'operations_portal'
    or nullif(current_setting('operations.user_id', true), '') is null
    or not operations.portal_has_membership(target_organisation, array['owner','contributor','billing_contact','viewer'])
  then raise exception 'Portal access is unavailable.' using errcode = '42501'; end if;
  return query
    select coalesce(s.revision, 0), coalesce(s.display_name, 'Faithful Software Solutions'),
      coalesce(s.timezone, 'Europe/London'), coalesce(s.response_expectation_hours, 48)
    from (select 1) defaults
    left join lateral (
      select a.revision, a.display_name, a.timezone, a.response_expectation_hours
      from operations.studio_settings_active a order by a.revision desc limit 1
    ) s on true;
end;
$$;
revoke all on function operations.portal_studio_presentation_settings(uuid)
  from public, anon, authenticated, service_role, growth_app, operations_founder,
    operations_portal, operations_billing_worker, operations_signing_worker, operations_onboarding_worker;
grant execute on function operations.portal_studio_presentation_settings(uuid) to operations_portal;
