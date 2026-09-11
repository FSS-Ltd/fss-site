-- Promoted through the approved Operations production release gate.
create schema operations;
create role operations_founder nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
revoke all on schema operations from public, anon, authenticated, service_role, growth_app;
grant usage on schema operations to operations_founder;
alter default privileges in schema operations revoke all on tables from public, anon, authenticated, service_role, growth_app;
alter default privileges in schema operations revoke execute on functions from public;

create table operations.organisations (
  id uuid primary key,
  legal_name text not null check (length(trim(legal_name)) between 1 and 200),
  display_name text not null check (length(trim(display_name)) between 1 and 200),
  trading_status text not null check (trading_status in ('active', 'inactive', 'unknown')),
  timezone text not null check (length(trim(timezone)) between 1 and 100),
  lifecycle text not null default 'active' check (lifecycle in ('active', 'archived')),
  created_by text not null check (created_by ~ '^[a-f0-9]{64}$'),
  review_reference text not null check (length(trim(review_reference)) between 1 and 200),
  created_at timestamptz not null default now()
);

create table operations.engagement_links (
  engagement_id uuid primary key references growth.delivery_engagements(id) on delete restrict,
  organisation_id uuid not null references operations.organisations(id) on delete restrict,
  created_by text not null check (created_by ~ '^[a-f0-9]{64}$'),
  review_reference text not null check (length(trim(review_reference)) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (organisation_id, engagement_id)
);

create table operations.audit_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references operations.organisations(id) on delete restrict,
  actor_id text not null check (actor_id ~ '^[a-f0-9]{64}$'),
  action text not null check (action in ('organisation.created', 'engagement.linked')),
  entity_id uuid not null,
  review_reference text not null check (length(trim(review_reference)) between 1 and 200),
  occurred_at timestamptz not null default now()
);
create index operations_audit_by_organisation on operations.audit_events (organisation_id, occurred_at desc);

alter table operations.organisations enable row level security;
alter table operations.organisations force row level security;
alter table operations.engagement_links enable row level security;
alter table operations.engagement_links force row level security;
alter table operations.audit_events enable row level security;
alter table operations.audit_events force row level security;

create policy founder_read on operations.organisations for select to operations_founder
  using (current_setting('operations.actor_id', true) ~ '^[a-f0-9]{64}$');
create policy founder_create on operations.organisations for insert to operations_founder
  with check (created_by = current_setting('operations.actor_id', true));
create policy founder_read on operations.engagement_links for select to operations_founder
  using (current_setting('operations.actor_id', true) ~ '^[a-f0-9]{64}$');
create policy founder_create on operations.engagement_links for insert to operations_founder
  with check (created_by = current_setting('operations.actor_id', true));
create policy founder_read on operations.audit_events for select to operations_founder
  using (current_setting('operations.actor_id', true) ~ '^[a-f0-9]{64}$');

grant select, insert on operations.organisations, operations.engagement_links to operations_founder;
grant select on operations.audit_events to operations_founder;
revoke all on all tables in schema operations from public, anon, authenticated, service_role, growth_app;

-- Trigger owns append-only evidence; runtime callers cannot forge, edit or delete it.
create function operations.audit_register_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'organisations' then
    insert into operations.audit_events (organisation_id, actor_id, action, entity_id, review_reference)
    values (new.id, new.created_by, 'organisation.created', new.id, new.review_reference);
  else
    insert into operations.audit_events (organisation_id, actor_id, action, entity_id, review_reference)
    values (new.organisation_id, new.created_by, 'engagement.linked', new.engagement_id, new.review_reference);
  end if;
  return new;
end;
$$;
revoke all on function operations.audit_register_insert() from public, anon, authenticated, service_role, growth_app, operations_founder;
create trigger organisation_created after insert on operations.organisations
  for each row execute function operations.audit_register_insert();
create trigger engagement_linked after insert on operations.engagement_links
  for each row execute function operations.audit_register_insert();
