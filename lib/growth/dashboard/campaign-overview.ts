import { randomUUID } from "node:crypto";
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
};
export type CampaignOverviewResult =
  | {
      status: "ready";
      rows: CampaignOverviewRow[];
      truncated: boolean;
      londonDate: string;
    }
  | { status: "error"; reference: string };

type Row = Omit<CampaignOverviewRow, "approved" | "offer" | "reportDue"> & {
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
      with latest as (
        select distinct on (id) id, name, version, status, approved_at, policy
        from growth.campaigns order by id, version desc
      ), selected as (
        select * from latest order by name, id limit 51
      )
      select c.id, c.name, c.version, c.status, c.approved_at as "approvedAt", c.policy,
        (select count(*)::int from growth.outreach_events e where e.campaign_id=c.id and e.event_type in ('first_message_prepared','follow_up_prepared') and (e.occurred_at at time zone 'Europe/London')::date=(${now}::timestamptz at time zone 'Europe/London')::date) as prepared,
        (select count(*)::int from growth.outreach_jobs j where j.campaign_id=c.id and j.status='held') as held,
        (select count(*)::int from growth.outreach_reservations r where r.campaign_id=c.id and r.london_day=(${now}::timestamptz at time zone 'Europe/London')::date and r.issued_snapshot is not null) as attempts,
        (select count(*)::int from growth.outreach_reservations r where r.campaign_id=c.id and (r.completed_at at time zone 'Europe/London')::date=(${now}::timestamptz at time zone 'Europe/London')::date and r.direct_submission_evidence is not null) as accepted,
        (select count(*)::int from growth.outreach_reservations r where r.campaign_id=c.id and (r.confirmation_observed_at at time zone 'Europe/London')::date=(${now}::timestamptz at time zone 'Europe/London')::date and r.confirmation_receipt is not null) as confirmed,
        (select j.last_error_code from growth.outreach_jobs j where j.campaign_id=c.id and j.status='held' and j.last_error_code is not null order by j.due_at,j.id limit 1) as "holdReason",
        (select j.due_at from growth.outreach_jobs j where j.campaign_id=c.id and j.job_type='monthly_report' and j.status in ('pending','leased','held') limit 1) as "reportDue"
        ,(select j.status from growth.outreach_jobs j where j.campaign_id=c.id and j.job_type='monthly_report' and j.status in ('pending','leased','held') limit 1) as "reportStatus"
      from selected c order by c.name,c.id
    `;
    return {
      status: "ready",
      rows: rows
        .slice(0, 50)
        .map(({ policy, approvedAt, reportDue, ...row }) => ({
          ...row,
          approved: approvedAt !== null,
          offer: offerLabel(policy),
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
