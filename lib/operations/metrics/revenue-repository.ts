import type { OperationsTransaction } from "../db/client";
import type { MetricFilters } from "./filters";
import type { RevenueSummary } from "./snapshot-types";
/** Aggregate the full filtered contract set in SQL; only the drill-down is paginated. */
export async function loadRevenue(
  tx: OperationsTransaction,
  f: MetricFilters,
): Promise<RevenueSummary> {
  const [result] = await tx<RevenueSummary[]>`
  with terms as materialized (
    select l.id,l.organisation_id,o.display_name as client,l.service_code as service,l.end_date,
      case when l.recurrence_months>0 then (l.quantity::numeric*l.unit_pence-l.discount_pence)*(12/l.recurrence_months) else 0 end as units,
      s.effective_date, coalesce(s.end_date,l.end_date) as effective_end,
      (e.evidence->>'signedDate')::date as signed_date,l.recurrence_months,
      l.quantity::numeric*l.unit_pence-l.discount_pence as net,l.agreement_id
    from operations.agreement_lines l
    join operations.signature_evidence e using(organisation_id,agreement_id,revision)
    join operations.organisations o on o.id=l.organisation_id
    left join operations.service_instances s using(organisation_id,agreement_id,revision,line_number)
    where (${f.organisationId ?? null}::uuid is null or l.organisation_id=${f.organisationId ?? null}::uuid)
      and (${f.client ?? null}::text is null or l.organisation_id in (select id from operations.organisations where display_name ilike ${`%${f.client ?? ""}%`}))
      and (${f.service ?? null}::text is null or (l.service_code ilike ${`%${f.service ?? ""}%`} or l.description ilike ${`%${f.service ?? ""}%`}))
      and (${f.owner ?? null}::text is null or exists(select 1 from operations.projects p where p.organisation_id=l.organisation_id and p.agreement_id=l.agreement_id and p.owner_display=${f.owner ?? null}))
      and (e.evidence->>'signedDate')::date<=${f.to}::date
  ), values_at as materialized (
    select *,case when effective_date<${f.from}::date and (effective_end is null or effective_end>=${f.from}::date-1) then units else 0 end as start_units,
      case when effective_date<=${f.to}::date and (effective_end is null or effective_end>=${f.to}::date) then units else 0 end as end_units,
      case when (effective_date is null or effective_date>${f.to}::date) and (effective_end is null or effective_end>=${f.to}::date) then units else 0 end as awaiting_units
    from terms
  ), clients as (
    select organisation_id,sum(start_units) as a,sum(end_units) as b,bool_or(effective_date<${f.from}::date) as previous from values_at group by organisation_id
  ), page as (select id,organisation_id as "organisationId",client,service,start_units::text as start,end_units::text as end,awaiting_units::text as awaiting,end_date::text as "endDate" from values_at where recurrence_months>0 order by client,id limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize})
  select coalesce(sum(b),0)::text as active,
    coalesce((select sum(awaiting_units) from values_at),0)::text as awaiting,
    coalesce(sum(a),0)::text as start,
    coalesce(sum(b) filter(where a=0 and b>0 and not previous),0)::text as new,
    coalesce(sum(b-a) filter(where a>0 and b>a),0)::text as expansion,
    coalesce(sum(b) filter(where a=0 and b>0 and previous),0)::text as reactivation,
    coalesce(sum(a-b) filter(where a>b and b>0),0)::text as contraction,
    coalesce(sum(a) filter(where a>0 and b=0),0)::text as churn,
    count(*) filter(where a>0)::text as cohort,count(*) filter(where a>0 and b>0)::text as retained,
    coalesce(sum(least(a,b)) filter(where a>0),0)::text as capped,
    coalesce(sum(b) filter(where a>0),0)::text as "cohortEnd",
    (select coalesce(sum(net),0)::text from values_at where recurrence_months=0 and signed_date>=${f.from}::date) as "signedOneOff",
    (select count(distinct agreement_id)::text from values_at where signed_date>=${f.from}::date) as "signedDeals",
    (select count(*)::integer from values_at where recurrence_months>0) as "totalRows",
    coalesce((select jsonb_agg(page) from page),'[]'::jsonb) as rows from clients`;
  if (
    BigInt(result.start) +
      BigInt(result.new) +
      BigInt(result.expansion) +
      BigInt(result.reactivation) -
      BigInt(result.contraction) -
      BigInt(result.churn) !==
    BigInt(result.active)
  )
    throw new Error("Revenue reconciliation failed.");
  return result;
}
