import type { GrowthDb } from "../db/types";

import {
  summarySchema,
  type DailyOutreachSummary,
} from "./daily-summary-contract";
export type { DailyOutreachSummary } from "./daily-summary-contract";

// The database determines both the London date and the evidence snapshot. A rerun
// returns the first immutable publication, including its original run time.
export async function publishDailyOutreachSummary(
  db: GrowthDb,
): Promise<DailyOutreachSummary> {
  const [row] = await db<{ evidence: unknown; day: string }[]>`
    with bounds as materialized (
      select statement_timestamp() as at,
        (statement_timestamp() at time zone 'Europe/London')::date as day
    ), limits as materialized (
      select *, day::timestamp at time zone 'Europe/London' as start_at from bounds
    ), events as materialized (
      select e.id from growth.outreach_events e, limits l
      where e.event_type in ('first_message_prepared','follow_up_prepared')
        and e.occurred_at >= l.start_at and e.occurred_at <= l.at limit 50001
    ), reservations as materialized (
      select r.*, coalesce(
        r.confirmation_receipt->>'basis' in ('gmail_fss_sent_observed','resend_fss_delivery_observed')
        and r.direct_submission_evidence is not null
        and (r.confirmation_receipt->>'basis' <> 'gmail_fss_sent_observed' or exists (
          select 1 from growth.email_messages em where em.id=r.email_message_id
            and em.sequence_enrollment_id=r.sequence_id and em.outreach_guarded_claim
        ))
        and r.confirmation_receipt->>'possibleInvocationFrom' = to_char(date_trunc('milliseconds',r.submitted_at) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), false) as bounded_invocation
      from growth.outreach_reservations r, limits l
      where r.campaign_id is not null and ((r.submitted_at >= l.start_at and r.submitted_at <= l.at)
        or (r.confirmation_observed_at >= l.start_at and r.confirmation_observed_at <= l.at))
      limit 50001
    ), jobs as materialized (
      select j.last_error_code from growth.outreach_jobs j
      where j.membership_id is not null and j.job_type in ('first_preparation','follow_up') and j.status='held'
      limit 50001
    ), counts as (
      select (select count(*) from events) as event_count,
        (select count(*) from reservations) as reservation_count,
        (select count(*) from jobs) as job_count
    ), inserted as (
      insert into growth.daily_outreach_summaries(london_day,generated_at,evidence)
      select l.day,l.at,jsonb_build_object(
        'version',1,'londonDay',l.day::text,'generatedAt',to_char(l.at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'dayStatus','partial_at_run', 'preparationEvents',c.event_count,
        'issuedAttempts',(select count(*) from reservations where submitted_at >= l.start_at and submitted_at <= l.at),
        'acceptedAtRead',(select count(*) from reservations where submitted_at >= l.start_at and submitted_at <= l.at and status='accepted' and direct_submission_evidence is not null and provider_message_id is not null),
        'observedConfirmations',(select count(*) from reservations where confirmation_receipt is not null and confirmation_observed_at >= l.start_at and confirmation_observed_at <= l.at),
        'confirmedWithinDay',(select count(*) from reservations where confirmation_receipt is not null and bounded_invocation and submitted_at >= l.start_at and confirmation_observed_at >= submitted_at and confirmation_observed_at <= l.at),
        'observedCrossDay',(select count(*) from reservations where confirmation_receipt is not null and bounded_invocation and confirmation_observed_at >= l.start_at and confirmation_observed_at <= l.at and submitted_at < l.start_at),
        'observedUnknownDay',(select count(*) from reservations where confirmation_receipt is not null and confirmation_observed_at >= l.start_at and confirmation_observed_at <= l.at and (not bounded_invocation or confirmation_observed_at < submitted_at)),
        'unconfirmedAttempts',(select count(*) from reservations where submitted_at >= l.start_at and submitted_at <= l.at and confirmation_receipt is null),
        'heldJobsAtRead',c.job_count,
        'heldReasons',jsonb_build_object(
          'permission',(select count(*) from jobs where last_error_code like '%permission%'),
          'account',(select count(*) from jobs where last_error_code not like '%permission%' and last_error_code like '%account%'),
          'coverage',(select count(*) from jobs where last_error_code not like '%permission%' and last_error_code not like '%account%' and last_error_code like '%coverage%'),
          'other',(select count(*) from jobs where last_error_code is null or (last_error_code not like '%permission%' and last_error_code not like '%account%' and last_error_code not like '%coverage%'))),
        'goal',jsonb_build_object('minimum',100,'target',150,'conditional',true),
        'limitations',jsonb_build_array('snapshot_at_run_not_closed_day','event_times_are_not_commit_times','actual_send_time_unknown','accepted_and_held_are_current_states','goal_depends_on_eligibility_and_account_health')
      ) from limits l cross join counts c
      where c.event_count<=50000 and c.reservation_count<=50000 and c.job_count<=50000
      on conflict (london_day) do nothing returning evidence
    ), publication_audit as (
      insert into growth.audit_log(correlation_id,actor_type,actor_id,action,entity_type,entity_id,metadata)
      select 'outreach-daily-summary:' || l.day::text,'cron','outreach-daily-summary',
        'outreach_daily_summary.published','outreach_daily_summary',l.day::text,'{}'::jsonb
      from inserted cross join limits l returning id
    ), notification as materialized (
      select pg_catalog.pg_notify('growth_daily_summary_changed','changed') from publication_audit
    ) select l.day::text as day, published.evidence,(select count(*) from notification) as notification_count from limits l
      left join lateral (
        select evidence from inserted
        union all select s.evidence from growth.daily_outreach_summaries s where s.london_day=l.day
        limit 1
      ) published on true`;
  if (!row) throw new Error("Daily summary clock unavailable");
  if (row.evidence) return summarySchema.parse(row.evidence);
  // A concurrent INSERT can win after this statement's snapshot was taken.
  const existing = await readDailyOutreachSummary(db, row.day);
  if (existing) return existing;
  throw new Error("Daily summary evidence exceeds bounds");
}

export async function readDailyOutreachSummary(
  db: GrowthDb,
  day: string,
): Promise<DailyOutreachSummary | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Invalid London day");
  const [row] = await db<
    { evidence: unknown }[]
  >`select evidence from growth.daily_outreach_summaries where london_day=${day}::date`;
  return row ? summarySchema.parse(row.evidence) : null;
}

// Read one retained snapshot, never a reconstructed live total.
export async function readLatestDailyOutreachSummary(
  db: GrowthDb,
): Promise<DailyOutreachSummary | null> {
  const [row] = await db<{ evidence: unknown }[]>`
    select evidence from growth.daily_outreach_summaries
    where london_day <= (statement_timestamp() at time zone 'Europe/London')::date
    order by london_day desc limit 1`;
  return row ? summarySchema.parse(row.evidence) : null;
}
