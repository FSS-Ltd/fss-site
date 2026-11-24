set lock_timeout = '5s';
set statement_timeout = '30s';

create table growth.outreach_account_controls (
 connection_id uuid primary key,
 provider growth.integration_provider not null default 'gmail' check (provider = 'gmail'),
 state text not null default 'paused' check (state in ('paused','active','halted')),
 ramp integer not null default 25 check (ramp in (25,50,100,150)),
 version integer not null default 1 check (version > 0),
 verified_subject text not null check (length(trim(verified_subject)) > 0),
 verified_grant_epoch integer not null check (verified_grant_epoch > 0),
 verified_scopes text[] not null,
 limits_review_id uuid,
 health_review_id uuid,
 last_ramp_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key (connection_id, provider) references growth.integration_connections(id,provider) on delete restrict
);
create table growth.outreach_account_reviews (
 id uuid primary key,
 connection_id uuid not null references growth.outreach_account_controls(connection_id) on delete restrict,
 request_id uuid not null unique,
 request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
 actor_id text not null check (actor_id ~ '^[a-f0-9]{64}$'),
 kind text not null check (kind in ('record_limits','record_health','activate','approve_ramp','reduce_ramp','halt','revalidate_grant')),
 evidence jsonb not null check (jsonb_typeof(evidence) = 'object'),
 resulting_version integer not null check (resulting_version > 0),
 recorded_at timestamptz not null default now(),
 unique (id, connection_id)
);
alter table growth.outreach_account_controls
 add constraint account_limits_review_fk foreign key (limits_review_id,connection_id) references growth.outreach_account_reviews(id,connection_id) on delete restrict,
 add constraint account_health_review_fk foreign key (health_review_id,connection_id) references growth.outreach_account_reviews(id,connection_id) on delete restrict;

alter table growth.outreach_provider_usage
 alter column observed_at drop not null,
 alter column rolling_messages drop not null,
 alter column rolling_recipients drop not null,
 alter column message_limit drop not null,
 alter column recipient_limit drop not null,
 add column connection_id uuid references growth.integration_connections(id) on delete restrict,
 add column grant_epoch integer check (grant_epoch > 0),
 add column captured_at timestamptz,
 add column window_start timestamptz,
 add column history_start text,
 add column history_end text,
 add column fresh_until timestamptz,
 add column incomplete_reason text,
 add column evidence_version integer check (evidence_version > 0),
 add column provider_message_ids jsonb check (provider_message_ids is null or (jsonb_typeof(provider_message_ids) = 'array' and jsonb_array_length(provider_message_ids) <= 1000));

alter table growth.outreach_account_controls enable row level security;
alter table growth.outreach_account_reviews enable row level security;
create policy growth_app_access on growth.outreach_account_controls for all to growth_app using (true) with check (true);
create policy growth_app_access on growth.outreach_account_reviews for select to growth_app using (true);
create policy growth_app_insert on growth.outreach_account_reviews for insert to growth_app with check (true);
revoke all on growth.outreach_account_controls, growth.outreach_account_reviews from public, anon, authenticated, service_role;
grant select, insert, update on growth.outreach_account_controls to growth_app;
grant select, insert on growth.outreach_account_reviews to growth_app;
