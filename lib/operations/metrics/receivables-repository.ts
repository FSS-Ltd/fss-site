import type { OperationsTransaction } from "../db/client";
import type { MetricFilters, MetricProviderScope } from "./filters";
import type { ReceivableSummary } from "./snapshot-types";
export async function loadReceivables(
  tx: OperationsTransaction,
  f: MetricFilters,
  scope: NonNullable<MetricProviderScope>,
): Promise<ReceivableSummary> {
  const [result] = await tx<ReceivableSummary[]>`
  with filtered as materialized (
    select i.id,i.organisation_id,i.schedule_id,i.status,i.total_pence,i.amount_paid_pence,i.amount_due_pence,i.amount_remaining_pence,i.due_date,i.number,i.issued_snapshot->>'issuedAt' as issued_at
    from operations.invoices i where i.account_id=${scope.accountId} and i.environment=${scope.mode} and i.currency=${f.currency}
      and (${f.organisationId ?? null}::uuid is null or i.organisation_id=${f.organisationId ?? null}::uuid)
      and (${f.client ?? null}::text is null or i.organisation_id in (select id from operations.organisations where display_name ilike ${`%${f.client ?? ""}%`}))
      and (${f.service ?? null}::text is null or exists(select 1 from operations.billing_schedules s join operations.agreement_lines l on l.agreement_id=s.agreement_id and l.revision=s.revision and l.organisation_id=s.organisation_id where s.id=i.schedule_id and (l.service_code ilike ${`%${f.service ?? ""}%`} or l.description ilike ${`%${f.service ?? ""}%`})))
      and (${f.owner ?? null}::text is null or exists(select 1 from operations.billing_schedules s join operations.projects p on p.agreement_id=s.agreement_id and p.organisation_id=s.organisation_id where s.id=i.schedule_id and p.owner_display=${f.owner ?? null}))
  ), allocations as (
    select a.invoice_id,sum(a.amount_pence) filter(where p.state='succeeded') as paid,max(p.confirmed_at) filter(where p.state='succeeded' and a.amount_pence>0) as confirmed,
      (array_agg(p.state order by (p.state='processing') desc,p.provider_created_at desc,p.id))[1] as payment_state,
      bool_or(exists(select 1 from operations.payment_disputes d where d.payment_id=p.id and d.status not in ('won','warning_closed','prevented'))) as dispute
    from operations.payment_allocations a join filtered i on i.id=a.invoice_id join operations.payments p on p.id=a.payment_id and p.organisation_id=a.organisation_id group by a.invoice_id
  ), credits as (select c.invoice_id,sum(c.amount_pence) filter(where c.status='issued') as credit from operations.invoice_credits c join filtered i on i.id=c.invoice_id group by c.invoice_id),
  balances as materialized (
    select i.id,i.organisation_id as "organisationId",i.schedule_id,i.number,
      (to_timestamp(nullif(i.issued_at,'')::double precision) at time zone 'Europe/London')::date::text as "issuedDate",i.due_date::text as "dueDate",i.total_pence::text as gross,
      i.amount_paid_pence::text as paid,coalesce(c.credit,0)::text as credit,
      case when i.status in ('void','draft') then 0 else i.amount_remaining_pence end as balance,
      case when i.due_date is null then null when i.status in ('void','draft') then 0
        when i.amount_remaining_pence>0 then greatest(0,${f.to}::date-i.due_date)
        when coalesce(a.paid,0)>=i.amount_due_pence and a.confirmed is not null then greatest(0,(a.confirmed at time zone 'Europe/London')::date-i.due_date)
        else null end as "daysLate",
      coalesce(a.payment_state,'unknown') as "paymentState",coalesce(a.dispute,false) as dispute,
      case when i.amount_remaining_pence=0 and coalesce(a.paid,0)>=i.amount_due_pence then a.confirmed else null end as "fullyPaidAt",
      i.status,i.due_date,coalesce(c.credit,0)>=i.total_pence and i.total_pence>0 as wholly_credited
    from filtered i left join allocations a on a.invoice_id=i.id left join credits c on c.invoice_id=i.id
  ), selected as materialized (select * from balances where ${f.paymentState}='all' or "paymentState"=${f.paymentState}),
  page_ids as (select * from selected order by due_date nulls last,id limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}),
  page as (select b.id,b."organisationId",o.display_name as client,b.number,b."issuedDate",b."dueDate",b.gross,b.paid,b.credit,b.balance::text as remaining,b."daysLate",b."paymentState",b.dispute,
    coalesce((select min(p.owner_display) from operations.billing_schedules s join operations.projects p on p.organisation_id=s.organisation_id and p.agreement_id=s.agreement_id where s.id=b.schedule_id),'Unassigned') as owner,b."fullyPaidAt"::text
    from page_ids b join operations.organisations o on o.id=b."organisationId"),
  ageing as (select case when "daysLate" is null then 'unknown due date' when "daysLate"=0 then 'current' when "daysLate"<=7 then '1–7' when "daysLate"<=30 then '8–30' when "daysLate"<=60 then '31–60' when "daysLate"<=90 then '61–90' else '91+' end as band,sum(balance)::text as total from selected group by 1)
  select coalesce(sum(balance),0)::text as outstanding,coalesce(sum(balance) filter(where "daysLate">0),0)::text as overdue,
    count(*) filter(where status not in ('void','draft') and not wholly_credited and due_date between ${f.from}::date and ${f.to}::date)::text as eligible,
    count(*) filter(where status not in ('void','draft') and not wholly_credited and due_date between ${f.from}::date and ${f.to}::date and ("fullyPaidAt" at time zone 'Europe/London')::date<=due_date)::text as "onTime",
    count(*) filter(where status not in ('void','draft') and not wholly_credited and due_date between ${f.from}::date and ${f.to}::date and balance=0 and "fullyPaidAt" is null)::integer as "unknownPunctuality",
    count(*)::integer as "totalRows",coalesce((select jsonb_agg(page) from page),'[]'::jsonb) as rows,
    coalesce((select jsonb_agg(ageing) from ageing),'[]'::jsonb) as ageing from selected`;
  return result;
}
