import type { OperationsTransaction } from "../db/client";
import type { MetricFilters, MetricProviderScope } from "./filters";
import type { MetricsSnapshot, ExceptionRow } from "./snapshot-types";
export async function loadOperationalQueue(
  tx: OperationsTransaction,
  f: MetricFilters,
  scope: MetricProviderScope,
): Promise<{
  exceptions: ExceptionRow[];
  exceptionCount: number;
  requests: { status: string; count: number }[];
  milestones: MetricsSnapshot["milestones"];
  milestoneCount: number;
}> {
  const [result] = await tx<
    {
      exceptions: ExceptionRow[];
      exceptionCount: number;
      requests: { status: string; count: number }[];
      milestones: MetricsSnapshot["milestones"];
      milestoneCount: number;
    }[]
  >`
    with requests as materialized (select r.id,r.organisation_id,r.status,r.created_at,r.owner_display from operations.requests r
      where (${f.organisationId ?? null}::uuid is null or r.organisation_id=${f.organisationId ?? null}::uuid)
      and (${f.client ?? null}::text is null or r.organisation_id in (select id from operations.organisations where display_name ilike ${`%${f.client ?? ""}%`}))
      and (${f.owner ?? null}::text is null or r.owner_display=${f.owner ?? null})
      and (${f.service ?? null}::text is null or exists(select 1 from operations.projects p join operations.agreement_lines l on l.agreement_id=p.agreement_id and l.organisation_id=p.organisation_id where p.id=r.project_id and (l.service_code ilike ${`%${f.service ?? ""}%`} or l.description ilike ${`%${f.service ?? ""}%`})))),
    queue as (
      select e.id::text as id,e.organisation_id as "organisationId",e.category as reason,e.created_at as since,'Founder'::text as owner,'/growth/operations/billing'::text as href,'Review collection'::text as "nextStep",1 as severity
      from operations.billing_exceptions e where e.resolved_at is null and e.account_id=${scope?.accountId ?? null} and e.environment=${scope?.mode ?? null}
      and (${f.organisationId ?? null}::uuid is null or e.organisation_id=${f.organisationId ?? null}::uuid)
      and (${f.client ?? null}::text is null or e.organisation_id in (select id from operations.organisations where display_name ilike ${`%${f.client ?? ""}%`}))
      and (${f.owner ?? null}::text is null and ${f.service ?? null}::text is null)
      union all
      select j.id::text,j.organisation_id,'Onboarding: '||j.step||' ('||j.state||')',j.due_at,'Founder','/growth/operations/clients/'||j.organisation_id::text||'/journey','Resolve onboarding',2
      from operations.onboarding_jobs j where j.state in ('held','unknown_outcome','retryable_failure')
      and (${f.organisationId ?? null}::uuid is null or j.organisation_id=${f.organisationId ?? null}::uuid)
      and (${f.client ?? null}::text is null or j.organisation_id in (select id from operations.organisations where display_name ilike ${`%${f.client ?? ""}%`}))
      and (${f.owner ?? null}::text is null and ${f.service ?? null}::text is null)
      union all
      select i.id::text,i.organisation_id,'Overdue invoice '||coalesce(i.number,i.id::text),i.due_date::timestamp at time zone 'Europe/London','Founder','/growth/operations/billing','Review overdue invoice',3
      from operations.invoices i where i.account_id=${scope?.accountId ?? null} and i.environment=${scope?.mode ?? null} and i.amount_remaining_pence>0 and i.status not in ('void','draft') and i.due_date<${f.to}::date
      and (${f.organisationId ?? null}::uuid is null or i.organisation_id=${f.organisationId ?? null}::uuid)
      and (${f.client ?? null}::text is null or i.organisation_id in (select id from operations.organisations where display_name ilike ${`%${f.client ?? ""}%`}))
      and (${f.owner ?? null}::text is null and ${f.service ?? null}::text is null)
      union all
      select r.id::text,r.organisation_id,case when r.status='new' then 'Request awaiting acknowledgement' else 'Deliverable awaiting review' end,
      case when r.status='new' then r.created_at else coalesce((select max(v.created_at) from operations.request_reviews v where v.request_id=r.id and v.decision='requested'),r.created_at) end,
      coalesce(nullif(r.owner_display,''),'Unassigned'),'/growth/operations/clients/'||r.organisation_id::text||'/requests/'||r.id::text,case when r.status='new' then 'Acknowledge request' else 'Review deliverable' end,case when r.status='new' then 4 else 5 end
      from requests r where r.status in ('new','ready_for_review')
      union all
      select s.id::text,s.organisation_id,'Contract end needs a renewal decision',s.end_date::timestamp at time zone 'Europe/London','Founder','/growth/operations/clients/'||s.organisation_id::text||'/agreements','Review renewal',6
      from operations.service_instances s where s.end_date between ${f.to}::date and ${f.to}::date+30
      and (${f.organisationId ?? null}::uuid is null or s.organisation_id=${f.organisationId ?? null}::uuid)
      and (${f.client ?? null}::text is null or s.organisation_id in (select id from operations.organisations where display_name ilike ${`%${f.client ?? ""}%`}))
      and (${f.owner ?? null}::text is null and ${f.service ?? null}::text is null)
    ), page_ids as (select * from queue order by severity,since,id limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}), page as (select q.*,coalesce(o.display_name,'Unmapped client') as client from page_ids q left join operations.organisations o on o.id=q."organisationId"), states as (select status,count(*)::integer as count from requests group by status),
    milestone_rows as materialized (select m.id,m.organisation_id as "organisationId",m.title,m.owner_display as owner,m.target_date::text as date from operations.milestones m where m.target_date between ${f.to}::date and ${f.to}::date+30 and m.status<>'completed'
      and (${f.organisationId ?? null}::uuid is null or m.organisation_id=${f.organisationId ?? null}::uuid)
      and (${f.client ?? null}::text is null or m.organisation_id in(select id from operations.organisations where display_name ilike ${`%${f.client ?? ""}%`}))
      and (${f.owner ?? null}::text is null or m.owner_display=${f.owner ?? null})
      and (${f.service ?? null}::text is null or exists(select 1 from operations.projects p join operations.agreement_lines l on l.agreement_id=p.agreement_id and l.organisation_id=p.organisation_id where p.id=m.project_id and (l.service_code ilike ${`%${f.service ?? ""}%`} or l.description ilike ${`%${f.service ?? ""}%`})) ) ),
    milestone_page as (select * from milestone_rows order by date,id limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize})
    select coalesce((select jsonb_agg(page order by severity,since,id) from page),'[]'::jsonb) as exceptions,
    (select count(*)::integer from queue) as "exceptionCount",coalesce((select jsonb_agg(states) from states),'[]'::jsonb) as requests, coalesce((select jsonb_agg(milestone_page) from milestone_page),'[]'::jsonb) as milestones,(select count(*)::integer from milestone_rows) as "milestoneCount"`;
  return result;
}
