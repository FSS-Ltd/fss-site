import { randomUUID } from "node:crypto";
import { readEditableCampaignPolicy } from "../campaigns/campaign-policy-editor";
import { serializeCampaignDefinition } from "../campaigns/lifecycle";
import { getGrowthDb } from "../db/client";
import type { GrowthQueryExecutor } from "../db/types";
import {
  isWebsiteServiceOffer,
  matchesWebsiteServiceOffer,
} from "../campaigns/website-service-offers";

export type CampaignOverviewRow = {
  id: string;
  name: string;
  version: number;
  status: string;
  approved: boolean;
  offer: string;
  prepared: number;
  held: number;
  attempts: number;
  accepted: number;
  confirmed: number;
  holdReason: string | null;
  reportDue: string | null;
  reportStatus: string | null;
  editorPolicy: ReturnType<typeof serializeCampaignDefinition> | null;
};
export type CampaignOverviewResult =
  | {
      status: "ready";
      rows: CampaignOverviewRow[];
      truncated: boolean;
      londonDate: string;
    }
  | { status: "error"; reference: string };

type Row = Omit<
  CampaignOverviewRow,
  "approved" | "offer" | "reportDue" | "editorPolicy"
> & {
  approvedAt: Date | null;
  policy: unknown;
  reportDue: Date | null;
};

function offerLabel(policy: unknown): string {
  if (!policy || typeof policy !== "object") return "Offer unknown";
  const record = policy as Record<string, unknown>;
  if (typeof record.offer !== "string") return "Offer unknown";
  if (isWebsiteServiceOffer(record.offer)) {
    if (!matchesWebsiteServiceOffer(record.offer, record.commercialTerms))
      return "Monthly terms unavailable";
    const terms = record.commercialTerms;
    return `${terms.name} · £${terms.monthlyPence / 100}/month`;
  }
  if (record.offer === "review") return "Review plan";
  if (record.offer === "website_preview") return "Private website preview";
  return "Offer unknown";
}

export async function getCampaignOverview(
  db: GrowthQueryExecutor = getGrowthDb(),
  now: Date = new Date(),
): Promise<CampaignOverviewResult> {
  try {
    const rows = await db<Row[]>`
      with bounds as (
        select (date_trunc('day', ${now}::timestamptz at time zone 'Europe/London') at time zone 'Europe/London') as start_at,
          ((date_trunc('day', ${now}::timestamptz at time zone 'Europe/London') + interval '1 day') at time zone 'Europe/London') as end_at,
          (${now}::timestamptz at time zone 'Europe/London')::date as london_day
      ), latest as (
        select distinct on (id) id, name, version, status, approved_at, policy
        from growth.campaigns order by id, version desc
      ), selected as materialized (
        select * from latest order by name, id limit 51
      ), events as (
        select e.campaign_id, count(*)::int as prepared
        from growth.outreach_events e join selected c on c.id=e.campaign_id cross join bounds b
        where e.event_type in ('first_message_prepared','follow_up_prepared')
          and e.occurred_at >= b.start_at and e.occurred_at < b.end_at
        group by e.campaign_id
      ), jobs as (
        select j.campaign_id, count(*) filter (where j.status='held')::int as held,
          (array_agg(j.last_error_code order by j.due_at,j.id)
            filter (where j.status='held' and j.last_error_code is not null))[1] as hold_reason,
          max(j.due_at) filter (where j.job_type='monthly_report' and j.status in ('pending','leased','held')) as report_due,
          max(j.status) filter (where j.job_type='monthly_report' and j.status in ('pending','leased','held')) as report_status
        from growth.outreach_jobs j join selected c on c.id=j.campaign_id
        group by j.campaign_id
      ), reservations as (
        select r.campaign_id,
          count(*) filter (where r.london_day=b.london_day and r.issued_snapshot is not null)::int as attempts,
          count(*) filter (where r.completed_at >= b.start_at and r.completed_at < b.end_at and r.direct_submission_evidence is not null)::int as accepted,
          count(*) filter (where r.confirmation_observed_at >= b.start_at and r.confirmation_observed_at < b.end_at and r.confirmation_receipt is not null)::int as confirmed
        from growth.outreach_reservations r join selected c on c.id=r.campaign_id cross join bounds b
        where r.london_day=b.london_day
          or (r.completed_at >= b.start_at and r.completed_at < b.end_at)
          or (r.confirmation_observed_at >= b.start_at and r.confirmation_observed_at < b.end_at)
        group by r.campaign_id
      )
      select c.id, c.name, c.version, c.status, c.approved_at as "approvedAt", c.policy,
        coalesce(e.prepared,0) as prepared,coalesce(j.held,0) as held,
        coalesce(r.attempts,0) as attempts,coalesce(r.accepted,0) as accepted,
        coalesce(r.confirmed,0) as confirmed,j.hold_reason as "holdReason",
        j.report_due as "reportDue",j.report_status as "reportStatus"
      from selected c left join events e on e.campaign_id=c.id
        left join jobs j on j.campaign_id=c.id left join reservations r on r.campaign_id=c.id
      order by c.name,c.id
    `;
    return {
      status: "ready",
      rows: rows
        .slice(0, 50)
        .map(({ policy, approvedAt, reportDue, ...row }) => ({
          ...row,
          approved: approvedAt !== null,
          offer: offerLabel(policy),
          editorPolicy: readEditableCampaignPolicy(policy)?.serialized ?? null,
          reportDue: reportDue?.toISOString() ?? null,
        })),
      truncated: rows.length > 50,
      londonDate: new Intl.DateTimeFormat("en-GB", {
        dateStyle: "long",
        timeZone: "Europe/London",
      }).format(now),
    };
  } catch {
    return { status: "error", reference: randomUUID() };
  }
}
