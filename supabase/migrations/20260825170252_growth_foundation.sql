create extension if not exists pgcrypto;

create schema if not exists growth;

revoke all on schema growth from public;
revoke all on schema growth from anon;
revoke all on schema growth from authenticated;
revoke all on schema growth from service_role;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'growth_app') then
    create role growth_app nologin;
  end if;
end
$$;

grant usage on schema growth to growth_app;

create type growth.corporate_type as enum (
  'limited_company',
  'llp',
  'scottish_partnership',
  'other_corporate'
);

create type growth.corporate_status as enum (
  'active',
  'inactive',
  'uncertain'
);

create type growth.subscriber_type as enum (
  'corporate',
  'individual',
  'uncertain'
);

create type growth.lawful_basis as enum (
  'legitimate_interests',
  'consent',
  'contract',
  'requested_service'
);

create type growth.prospect_status as enum (
  'new',
  'researching',
  'needs_review',
  'ready_for_email_review',
  'qualified',
  'contacted',
  'replied',
  'started_talks',
  'proposal',
  'negotiation',
  'won',
  'lost',
  'rejected',
  'suppressed'
);

create type growth.integration_provider as enum (
  'gmail',
  'resend',
  'vercel_blob'
);

create type growth.connection_status as enum (
  'disconnected',
  'connected',
  'degraded',
  'error',
  'revoked'
);

create table growth.businesses (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trading_name text,
  company_number text,
  corporate_type growth.corporate_type not null,
  corporate_status growth.corporate_status not null,
  sector text not null,
  locality text not null,
  county text not null check (county = 'Kent'),
  website_url text,
  google_place_id text unique,
  google_maps_reference_url text,
  first_party_source_url text not null,
  verified_at timestamptz not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index businesses_company_number_unique_idx
  on growth.businesses (upper(regexp_replace(company_number, '\s+', '', 'g')))
  where company_number is not null;

create index businesses_county_sector_idx
  on growth.businesses (county, sector);

create index businesses_status_verified_idx
  on growth.businesses (corporate_status, verified_at desc);

create table growth.contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references growth.businesses(id) on delete restrict,
  first_name text not null,
  last_name text not null,
  role_title text,
  email text not null,
  normalised_email text generated always as (lower(trim(email))) stored,
  email_source_url text not null,
  email_verified_at timestamptz not null,
  subscriber_type growth.subscriber_type not null,
  lawful_basis growth.lawful_basis not null,
  privacy_notice_version text,
  privacy_notice_sent_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  unique (normalised_email)
);

create index contacts_business_id_idx
  on growth.contacts (business_id);

create table growth.prospects (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references growth.businesses(id) on delete restrict,
  primary_contact_id uuid,
  research_run_id uuid,
  status growth.prospect_status not null default 'new',
  fit_score smallint not null check (fit_score between 0 and 100),
  opportunity_summary text not null,
  recommended_offer text not null,
  estimated_one_off_min_pence integer not null
    check (estimated_one_off_min_pence >= 0),
  estimated_one_off_max_pence integer not null
    check (estimated_one_off_max_pence >= estimated_one_off_min_pence),
  estimated_monthly_pence integer not null default 0
    check (estimated_monthly_pence >= 0),
  next_action text,
  next_action_due_at timestamptz,
  assigned_owner_email text not null
    check (lower(trim(assigned_owner_email)) = 'j.ntagengwa@faithfulsoftware.dev'),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (primary_contact_id, business_id)
    references growth.contacts(id, business_id) on delete restrict
);

create unique index one_open_prospect_per_business
  on growth.prospects (business_id)
  where status not in ('won', 'lost', 'rejected', 'suppressed');

create index prospects_status_next_action_idx
  on growth.prospects (status, next_action_due_at);

create index prospects_fit_score_created_idx
  on growth.prospects (fit_score desc, created_at desc);

create index prospects_primary_contact_id_idx
  on growth.prospects (primary_contact_id)
  where primary_contact_id is not null;

create table growth.integration_connections (
  id uuid primary key default gen_random_uuid(),
  provider growth.integration_provider not null,
  subject_email text not null,
  encrypted_refresh_token text,
  encryption_key_version text,
  granted_scopes text[] not null default '{}',
  access_token_expires_at timestamptz,
  provider_cursor text,
  status growth.connection_status not null default 'disconnected',
  last_synced_at timestamptz,
  last_error_code text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, subject_email)
);

create table growth.audit_log (
  id uuid primary key default gen_random_uuid(),
  correlation_id text not null,
  actor_type text not null
    check (actor_type in ('founder', 'agent', 'cron', 'provider', 'system')),
  actor_id text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index audit_log_correlation_id_idx
  on growth.audit_log (correlation_id);

create index audit_log_entity_idx
  on growth.audit_log (entity_type, entity_id, created_at desc);

create index audit_log_created_at_idx
  on growth.audit_log (created_at desc);

revoke all on all tables in schema growth from public, anon, authenticated, service_role;
revoke all on all sequences in schema growth from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema growth
  revoke all on tables from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema growth
  revoke all on sequences from public, anon, authenticated, service_role;

grant usage
  on type growth.corporate_type,
          growth.corporate_status,
          growth.subscriber_type,
          growth.lawful_basis,
          growth.prospect_status,
          growth.integration_provider,
          growth.connection_status
  to growth_app;

grant select, insert, update
  on growth.businesses,
     growth.contacts,
     growth.prospects,
     growth.integration_connections
  to growth_app;

grant select, insert on growth.audit_log to growth_app;
