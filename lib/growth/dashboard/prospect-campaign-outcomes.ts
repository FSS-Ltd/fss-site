import type { FounderSession } from "../auth/require-founder";
import { requireCampaignFounder } from "../campaigns/authorization";
import { getGrowthDb } from "../db/client";
import type { GrowthQueryExecutor } from "../db/types";

export type ProspectOutcomes =
  | { status: "unavailable" }
  | {
      status: "ready";
      memberships: {
        id: string;
        campaign: string;
        policyVersion: number;
        prospectVersion: number;
        contactVersion: number;
        submittedAt: string;
      }[];
      meetings: { id: string; recordedAt: string; attributed: boolean }[];
      proposals: {
        id: string;
        engagementId: string;
        recordedAt: string;
        attributed: boolean;
      }[];
      truncated: boolean;
    };

export async function getProspectCampaignOutcomes(
  prospectId: string,
  founder: FounderSession,
  db?: GrowthQueryExecutor,
): Promise<ProspectOutcomes> {
  requireCampaignFounder(founder);
  try {
    const query = db ?? getGrowthDb();
    const [members, meetings, proposals] = await Promise.all([
      query<
        {
          id: string;
          campaign: string;
          policyVersion: number;
          prospectVersion: number;
          contactVersion: number;
          submittedAt: Date;
        }[]
      >`
        select m.id, c.name as campaign,m.policy_version as "policyVersion",p.version as "prospectVersion",ct.version as "contactVersion",r.submitted_at as "submittedAt"
        from growth.campaign_memberships m join growth.prospects p on p.id=m.prospect_id and p.business_id=m.business_id
        join growth.contacts ct on ct.id=p.primary_contact_id
        join growth.sequence_enrollments se on se.id=m.sequence_id and se.prospect_id=p.id and se.contact_id=ct.id
        join growth.campaigns c on c.id=m.campaign_id and c.version=m.policy_version
        join growth.outreach_reservations r on r.id=m.first_confirmation_reservation_id and r.membership_id=m.id and r.sequence_id=m.sequence_id
        join growth.email_messages em on em.id=r.email_message_id and em.sequence_enrollment_id=m.sequence_id
        where m.prospect_id=${prospectId} and r.confirmation_receipt->>'basis' in ('gmail_fss_sent_observed','resend_fss_delivery_observed')
          and r.direct_submission_evidence is not null and r.confirmation_observed_at is not null and r.submitted_at is not null
          and r.confirmation_receipt->>'possibleInvocationFrom'=to_char(date_trunc('milliseconds',r.submitted_at) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          and (r.confirmation_receipt->>'basis'<>'gmail_fss_sent_observed' or em.outreach_guarded_claim)
        order by r.submitted_at desc,m.id limit 21`,
      query<{ id: string; recordedAt: Date; attributed: boolean }[]>`
        select a.id,a.created_at as "recordedAt",exists(select 1 from growth.outreach_events e where e.review_meeting_activity_id=a.id) as attributed
        from growth.crm_activities a where a.prospect_id=${prospectId} and a.activity_type='meeting' order by a.created_at desc,a.id limit 21`,
      query<
        {
          id: string;
          engagementId: string;
          recordedAt: Date;
          attributed: boolean;
        }[]
      >`
        select e.id,e.engagement_id as "engagementId",e.occurred_at as "recordedAt",exists(select 1 from growth.outreach_events x where x.review_proposal_event_id=e.id) as attributed
        from growth.commercial_stage_events e join growth.delivery_engagements d on d.id=e.engagement_id
        where d.prospect_id=${prospectId} and e.dimension='commercial' and e.to_state='proposal' order by e.occurred_at desc,e.id limit 21`,
    ]);
    const validDate = (date: Date) =>
      date instanceof Date && Number.isFinite(date.getTime());
    if (
      members.some((item) => !validDate(item.submittedAt)) ||
      meetings.some((item) => !validDate(item.recordedAt)) ||
      proposals.some((item) => !validDate(item.recordedAt))
    )
      return { status: "unavailable" };
    return {
      status: "ready",
      memberships: members.slice(0, 20).map((item) => ({
        ...item,
        submittedAt: item.submittedAt.toISOString(),
      })),
      meetings: meetings.slice(0, 20).map((item) => ({
        ...item,
        recordedAt: item.recordedAt.toISOString(),
      })),
      proposals: proposals.slice(0, 20).map((item) => ({
        ...item,
        recordedAt: item.recordedAt.toISOString(),
      })),
      truncated:
        members.length > 20 || meetings.length > 20 || proposals.length > 20,
    };
  } catch {
    return { status: "unavailable" };
  }
}
