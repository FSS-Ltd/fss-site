-- Facebook founder decisions and public observations are separate append-only records.
alter table growth.facebook_destinations add column version integer not null default 1 check (version > 0);
create table growth.facebook_discovery_runs (
  id uuid primary key default gen_random_uuid(), external_run_id text not null unique,
  request_hash text not null, agent_id text not null, observed_at timestamptz not null,
  observation_count integer not null check (observation_count between 0 and 10), created_at timestamptz not null default now()
);
create table growth.facebook_destination_observations (
  id uuid primary key default gen_random_uuid(), destination_id uuid not null references growth.facebook_destinations(id),
  discovery_run_id uuid references growth.facebook_discovery_runs(id), source_url text not null, summary text not null,
  observed_at timestamptz not null, provenance text not null check (provenance in ('founder','signed_agent')),
  actor_id text not null, created_at timestamptz not null default now()
);
create index facebook_observations_destination_idx on growth.facebook_destination_observations(destination_id, created_at desc, id desc);
create table growth.facebook_rules_reviews (
  id uuid primary key default gen_random_uuid(), destination_id uuid not null references growth.facebook_destinations(id),
  source_url text not null, summary text not null, observed_at timestamptz not null, expires_at timestamptz not null,
  decision text not null check (decision in ('allowed','unknown','prohibited')), actor_id text not null, reviewed_version integer not null,
  created_at timestamptz not null default now(), check (expires_at > observed_at and expires_at <= observed_at + interval '30 days')
);
create index facebook_rules_destination_idx on growth.facebook_rules_reviews(destination_id, reviewed_version desc);
alter table growth.facebook_activities add column evidence_url text, add column prospect_id uuid references growth.prospects(id);
create index facebook_activities_membership_idx on growth.facebook_activities(destination_id, activity);
create table growth.facebook_destination_prospects (
  destination_id uuid not null references growth.facebook_destinations(id), prospect_id uuid not null references growth.prospects(id),
  created_at timestamptz not null default now(), primary key(destination_id, prospect_id)
);
create index facebook_destination_prospects_prospect_idx on growth.facebook_destination_prospects(prospect_id);
create table growth.facebook_pilot_allocations (
  slot smallint primary key check (slot in (1,2)), business_id uuid not null unique references growth.businesses(id),
  prospect_id uuid not null, actor_id text not null, created_at timestamptz not null default now(),
  foreign key (prospect_id,business_id) references growth.prospects(id,business_id)
);
create table growth.facebook_command_requests (
  request_id uuid primary key, request_hash text not null, actor_id text not null,
  result_id uuid not null, created_at timestamptz not null default now()
);
alter table growth.prospect_preview_change_requests add column facebook_pilot_slot smallint references growth.facebook_pilot_allocations(slot), add column request_id uuid, add column request_hash text;
create unique index preview_change_pilot_unique on growth.prospect_preview_change_requests(facebook_pilot_slot) where facebook_pilot_slot is not null;
create unique index preview_change_request_id_unique on growth.prospect_preview_change_requests(request_id) where request_id is not null;
do $$ declare t text; begin
  foreach t in array array['facebook_discovery_runs','facebook_destination_observations','facebook_rules_reviews','facebook_destination_prospects','facebook_pilot_allocations','facebook_command_requests'] loop
    execute format('alter table growth.%I enable row level security', t);
    execute format('create policy growth_app_access on growth.%I for all to growth_app using (true) with check (true)', t);
    execute format('revoke all on growth.%I from public, anon, authenticated, service_role', t);
    execute format('grant select, insert on growth.%I to growth_app', t);
  end loop;
end $$;
create function growth.notify_audit_change() returns trigger language plpgsql set search_path = '' as $$
begin perform pg_catalog.pg_notify('growth_audit_changed', new.id::text); return new; end $$;
revoke all on function growth.notify_audit_change() from public, anon, authenticated, service_role;
create trigger audit_change_notify after insert on growth.audit_log for each row execute function growth.notify_audit_change();
