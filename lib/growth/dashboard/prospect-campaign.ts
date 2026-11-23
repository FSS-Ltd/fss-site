import type { FounderSession } from "../auth/require-founder";
import { requireCampaignFounder } from "../campaigns/authorization";
import { founderVerificationInputSchema } from "../campaigns/founder-verification";
import { loadFounderVerification } from "../campaigns/founder-verification-reader";
import { validateCampaignDefinition } from "../campaigns/lifecycle";
import { campaignPolicyDefinitionSchema } from "../campaigns/schemas";
import { getGrowthDb } from "../db/client";
import type { GrowthQueryExecutor } from "../db/types";

export type ProspectCampaignResult =
  | {
      status: "ready";
      verification: {
        status: "current" | "stale";
        email: string;
        observation: string;
        contactSourceUrl: string;
        contactObservedAt: string;
        observationSourceUrl: string;
        observedAt: string;
        freshUntil: string;
      } | null;
      reviewStatus: "available" | "excluded" | "already_in_outreach";
      campaigns: Array<{
        id: string;
        name: string;
        version: number;
        offer: string;
        status: "approved" | "paused";
      }>;
      truncated: boolean;
    }
  | { status: "unavailable" };

export async function getProspectCampaign(
  prospectId: string,
  prospectVersion: number,
  founder: FounderSession,
  db: GrowthQueryExecutor = getGrowthDb(),
  now = new Date(),
): Promise<ProspectCampaignResult> {
  requireCampaignFounder(founder);
  try {
    const [source, eligibility, rows] = await Promise.all([
      loadFounderVerification(db, prospectId, now, founder),
      db<
        {
          status: string;
          isClient: boolean;
          suppressed: boolean;
          active: boolean;
        }[]
      >`
        select p.status,growth.is_outreach_client(p.id) as "isClient",
          exists(select 1 from growth.suppressions s left join growth.contacts c on c.id=p.primary_contact_id
            where s.business_id=p.business_id or s.normalised_email=c.normalised_email or s.normalised_email=lower(trim(p.source_details->>'email'))) as suppressed,
          (exists(select 1 from growth.campaign_memberships m where m.business_id=p.business_id and m.status in ('review','active','paused'))
            or exists(select 1 from growth.sequence_enrollments se join growth.prospects other on other.id=se.prospect_id where other.business_id=p.business_id and se.status in ('pending_approval','active','paused'))) as active
        from growth.prospects p where p.id=${prospectId}`,
      db<
        {
          id: string;
          name: string;
          version: number;
          status: "approved" | "paused";
          approvedAt: Date;
          approvedBy: string;
          policy: unknown;
        }[]
      >`
        select id,name,version,status,approved_at as "approvedAt",approved_by as "approvedBy",policy
        from (select distinct on (id) id,name,version,status,approved_at,approved_by,policy from growth.campaigns order by id,version desc) latest
        where status in ('approved','paused') and approved_by=${founder.actorId} and approved_at is not null
        order by name,id limit 51`,
    ]);
    if (
      source &&
      (!founderVerificationInputSchema.shape.contactSourceUrl.safeParse(
        source.contactSourceUrl,
      ).success ||
        !founderVerificationInputSchema.shape.observationSourceUrl.safeParse(
          source.observationSourceUrl,
        ).success)
    )
      return { status: "unavailable" };
    const prospect = eligibility[0];
    if (!prospect) return { status: "unavailable" };
    const reviewStatus =
      prospect.isClient ||
      prospect.suppressed ||
      ["suppressed", "rejected", "won", "lost"].includes(prospect.status)
        ? "excluded"
        : prospect.active
          ? "already_in_outreach"
          : "available";
    const campaigns = rows.flatMap((row) => {
      const parsed = campaignPolicyDefinitionSchema.safeParse(row.policy);
      if (!parsed.success || row.approvedAt > now) return [];
      try {
        validateCampaignDefinition(parsed.data, row.version, now, true);
      } catch {
        return [];
      }
      return [
        {
          id: row.id,
          name: row.name,
          version: row.version,
          offer: parsed.data.offer ?? "Unknown",
          status: row.status,
        },
      ];
    });
    return {
      status: "ready",
      verification: source
        ? {
            status:
              source.status === "current" &&
              source.proofProspectVersion === prospectVersion
                ? "current"
                : "stale",
            email: source.email,
            observation: source.observation,
            contactSourceUrl: source.contactSourceUrl,
            contactObservedAt: source.contactObservedAt.toISOString(),
            observationSourceUrl: source.observationSourceUrl,
            observedAt: source.observedAt.toISOString(),
            freshUntil: source.freshUntil.toISOString(),
          }
        : null,
      reviewStatus,
      campaigns: campaigns.slice(0, 50),
      truncated: rows.length > 50,
    };
  } catch {
    return { status: "unavailable" };
  }
}
