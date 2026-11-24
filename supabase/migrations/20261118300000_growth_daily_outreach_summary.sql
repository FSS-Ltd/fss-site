begin;
set local lock_timeout = '5s';
create table growth.daily_outreach_summaries (
  london_day date primary key,
  generated_at timestamptz not null,
  evidence jsonb not null check (jsonb_typeof(evidence) = 'object')
);
alter table growth.daily_outreach_summaries enable row level security;
alter table growth.daily_outreach_summaries force row level security;
create policy growth_app_access on growth.daily_outreach_summaries for all to growth_app using (true) with check (true);
revoke all on growth.daily_outreach_summaries from public, anon, authenticated, service_role;
grant select, insert on growth.daily_outreach_summaries to growth_app;
create index outreach_daily_preparation_events_idx on growth.outreach_events(occurred_at) where event_type in ('first_message_prepared','follow_up_prepared');
create index outreach_daily_submitted_idx on growth.outreach_reservations(submitted_at) where campaign_id is not null and submitted_at is not null;
create index outreach_daily_observed_idx on growth.outreach_reservations(confirmation_observed_at) where campaign_id is not null and confirmation_observed_at is not null;
create index outreach_daily_held_jobs_idx on growth.outreach_jobs(id) where membership_id is not null and job_type in ('first_preparation','follow_up') and status='held';
commit;
