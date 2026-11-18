set lock_timeout = '5s';
set statement_timeout = '30s';

create table growth.gmail_reply_coverage (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references growth.integration_connections(id) on delete restrict,
  grant_epoch integer not null check (grant_epoch > 0),
  google_subject text not null check (length(trim(google_subject)) > 0),
  history_start text check (history_start ~ '^[0-9]{1,32}$'),
  history_end text not null check (history_end ~ '^[0-9]{1,32}$'),
  observed_from timestamptz,
  observed_until timestamptz not null,
  head_requested_at timestamptz not null,
  head_responded_at timestamptz not null,
  check (head_requested_at <= head_responded_at),
  state text not null check (state in ('complete', 'gap')),
  reason text,
  unknown_observations jsonb not null default '[]'::jsonb
    check (jsonb_typeof(unknown_observations) = 'array' and jsonb_array_length(unknown_observations) <= 1000),
  created_at timestamptz not null default now(),
  check (
    (state = 'complete' and history_start is not null and observed_from is not null
      and observed_from < observed_until and observed_until <= head_requested_at and reason is null and unknown_observations = '[]'::jsonb)
    or
    (state = 'gap' and observed_until <= head_responded_at and reason is not null and length(trim(reason)) > 0
      and ((history_start is null and observed_from is null)
        or (history_start is not null and observed_from is not null and observed_from < observed_until)))
  )
);
create index gmail_reply_coverage_window_idx on growth.gmail_reply_coverage
  (connection_id, google_subject, observed_from, observed_until, grant_epoch);
create unique index gmail_reply_coverage_replay_idx on growth.gmail_reply_coverage
  (connection_id, google_subject, grant_epoch, history_start, history_end, state, observed_from, observed_until) nulls not distinct;

alter table growth.gmail_reply_coverage enable row level security;
create policy growth_app_read on growth.gmail_reply_coverage for select to growth_app using (true);
create policy growth_app_insert on growth.gmail_reply_coverage for insert to growth_app with check (true);
revoke all on growth.gmail_reply_coverage from public, anon, authenticated, service_role;
grant select, insert on growth.gmail_reply_coverage to growth_app;

alter table growth.outreach_provider_usage
  add column observation_subject text,
  add column observation_scopes text[],
  add column observation_revision integer not null default 0 check (observation_revision >= 0);
