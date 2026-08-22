-- Task 1 of Plan 06 (FSS Growth OS Pipeline And Delivery): the commercial
-- lifecycle layer sits on top of growth.prospects rather than duplicating
-- it. A prospect gets at most one delivery_engagements row (see
-- unique_engagement_prospect below); a later opportunity for the same
-- business gets a new historical prospect and engagement instead of
-- rewriting a closed record.

create type growth.commercial_stage as enum (
  'new',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost'
);

create type growth.delivery_status as enum (
  'not_started',
  'discovery',
  'build',
  'review',
  'complete',
  'support',
  'cancelled'
);

create type growth.stage_dimension as enum (
  'commercial',
  'delivery'
);

create table growth.delivery_engagements (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references growth.prospects(id) on delete restrict,
  version integer not null default 1 check (version > 0),
  stage growth.commercial_stage not null default 'new',
  name text not null check (length(trim(name)) > 0),
  one_off_value_pence integer check (one_off_value_pence >= 0),
  monthly_value_pence integer check (monthly_value_pence >= 0),
  probability_percent smallint not null default 0
    check (probability_percent between 0 and 100),
  expected_close_date date,
  won_at timestamptz,
  lost_at timestamptz,
  loss_reason text,
  delivery_status growth.delivery_status not null default 'not_started',
  delivery_start_date date,
  delivery_target_date date,
  newsletter_invited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_engagement_won_requires_value_and_timestamp check (
    stage <> 'won'
    or (
      won_at is not null
      and coalesce(one_off_value_pence, 0) + coalesce(monthly_value_pence, 0) > 0
    )
  ),
  constraint delivery_engagement_lost_requires_reason_and_timestamp check (
    stage <> 'lost'
    or (lost_at is not null and length(trim(coalesce(loss_reason, ''))) > 0)
  ),
  constraint delivery_engagement_open_stage_has_no_terminal_timestamp check (
    stage in ('won', 'lost') or (won_at is null and lost_at is null)
  ),
  constraint delivery_engagement_won_lost_mutually_exclusive check (
    won_at is null or lost_at is null
  ),
  constraint delivery_engagement_delivery_requires_won check (
    delivery_status = 'not_started' or stage = 'won'
  )
);

create unique index unique_engagement_prospect
  on growth.delivery_engagements (prospect_id);

create index delivery_engagements_by_stage
  on growth.delivery_engagements (stage, updated_at desc);

create index won_delivery_engagements
  on growth.delivery_engagements (won_at desc, prospect_id)
  where won_at is not null;

-- Task 2 owns the delivery transition table (discovery -> build -> review ->
-- complete -> support, with cancellation from the documented in-progress
-- states). These two triggers only enforce the dead ends the plan states at
-- the schema level: a won or lost commercial stage never changes again, and
-- a support or cancelled delivery is final. A complete delivery may still
-- advance to support, so that one case is a narrower check than "terminal".

create function growth.reject_terminal_commercial_stage_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.stage in ('won', 'lost') and new.stage is distinct from old.stage then
    raise exception 'a won or lost commercial stage cannot be reopened'
      using errcode = '23514';
  end if;

  return new;
end
$$;

create trigger reject_terminal_commercial_stage_change
before update on growth.delivery_engagements
for each row
execute function growth.reject_terminal_commercial_stage_change();

create function growth.reject_terminal_delivery_status_regression()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.delivery_status in ('support', 'cancelled')
    and new.delivery_status is distinct from old.delivery_status
  then
    raise exception 'a support or cancelled delivery status cannot be reopened'
      using errcode = '23514';
  end if;

  if old.delivery_status = 'complete'
    and new.delivery_status is distinct from old.delivery_status
    and new.delivery_status <> 'support'
  then
    raise exception 'a complete delivery can only advance to support'
      using errcode = '23514';
  end if;

  return new;
end
$$;

create trigger reject_terminal_delivery_status_regression
before update on growth.delivery_engagements
for each row
execute function growth.reject_terminal_delivery_status_regression();

create table growth.commercial_stage_events (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null
    references growth.delivery_engagements(id) on delete restrict,
  dimension growth.stage_dimension not null,
  from_state text not null check (length(trim(from_state)) > 0),
  to_state text not null check (length(trim(to_state)) > 0),
  reason_code text,
  actor_type text not null
    check (actor_type in ('founder', 'agent', 'cron', 'provider', 'system')),
  actor_id text not null check (length(trim(actor_id)) > 0),
  correlation_id text not null check (length(trim(correlation_id)) > 0),
  occurred_at timestamptz not null default now()
);

create index commercial_stage_events_engagement_idx
  on growth.commercial_stage_events (engagement_id, occurred_at desc);

create index commercial_stage_events_correlation_id_idx
  on growth.commercial_stage_events (correlation_id);

revoke all on growth.delivery_engagements from public, anon, authenticated, service_role;
revoke all on growth.commercial_stage_events from public, anon, authenticated, service_role;

grant usage
  on type growth.commercial_stage,
          growth.delivery_status,
          growth.stage_dimension
  to growth_app;

grant select, insert, update on growth.delivery_engagements to growth_app;

-- Append-only: the runtime role can record history but never rewrite or
-- erase it, matching growth.audit_log.
grant select, insert on growth.commercial_stage_events to growth_app;
