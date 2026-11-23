import type { FounderSession } from "../auth/require-founder";
import { requireCampaignFounder } from "../campaigns/authorization";
import { founderVerificationInputSchema } from "../campaigns/founder-verification";
import { loadFounderVerification } from "../campaigns/founder-verification-reader";
import { isSupportedPermission } from "../campaigns/permission-evidence";
import { validateCampaignDefinition } from "../campaigns/lifecycle";
import { campaignPolicyDefinitionSchema } from "../campaigns/schemas";
import { getGrowthDb } from "../db/client";
import type { GrowthQueryExecutor } from "../db/types";

export type ProspectCampaignResult =
  | {
      status: "ready";
      verification: {
        status: "current" | "stale";
        requestId: string;
        contactVersion: number;
        prospectVersion: number;
        email: string;
        observation: string;
        contactSourceUrl: string;
        contactObservedAt: string;
        observationSourceUrl: string;
        observedAt: string;
        freshUntil: string;
      } | null;
      reviewStatus: "available" | "excluded" | "already_in_outreach";
      membership: {
        id: string;
        campaignName: string;
        policyVersion: number;
        status: string;
        provider: "gmail" | "resend";
        jurisdiction: string | null;
        basis: "consent" | "requested_service" | null;
        offer: string | null;
        canRecord: boolean;
        permissionExpiresAt: string | null;
        preparation: { status: string; reason: string | null } | null;
      } | null;
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
    const [source, eligibility, rows, memberships] = await Promise.all([
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
      db<
        {
          id: string;
          campaignName: string;
          policyVersion: number;
          status: string;
          policyStatus: string;
          approvedBy: string | null;
          approvedAt: Date | null;
          latestVersion: number;
          country: string;
          policy: unknown;
          permissionExpiresAt: Date | null;
          preparationStatus: string | null;
          preparationReason: string | null;
        }[]
      >`
        select m.id,c.name as "campaignName",m.policy_version as "policyVersion",m.status,c.status as "policyStatus",c.approved_by as "approvedBy",c.approved_at as "approvedAt",
          (select max(version) from growth.campaigns where id=m.campaign_id) as "latestVersion",b.country_code as country,c.policy,
          perm.expires_at as "permissionExpiresAt",j.status as "preparationStatus",j.last_error_code as "preparationReason"
        from growth.campaign_memberships m join growth.prospects p on p.id=m.prospect_id join growth.businesses b on b.id=p.business_id
        join growth.campaigns c on c.id=m.campaign_id and c.version=m.policy_version
        left join growth.outreach_permissions perm on perm.id=m.current_permission_id and perm.membership_id=m.id
        left join growth.outreach_events e on e.result_id=perm.id and e.membership_id=m.id and e.event_type='record_permission'
        left join growth.outreach_outbox o on o.event_id=e.id
        left join growth.outreach_jobs j on j.outbox_id=o.id and j.membership_id=m.id and j.job_type='first_preparation'
        where m.prospect_id=${prospectId} and m.status in ('review','active','paused') order by m.created_at desc limit 2`,
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
    if (memberships.length > 1) return { status: "unavailable" };
    const member = memberships[0];
    const parsedPolicy = campaignPolicyDefinitionSchema.safeParse(
      member?.policy,
    );
    let policyValid = false;
    if (
      member &&
      parsedPolicy.success &&
      member.latestVersion === member.policyVersion &&
      member.policyStatus !== "revoked" &&
      member.approvedBy === founder.actorId &&
      member.approvedAt &&
      member.approvedAt <= now
    ) {
      try {
        validateCampaignDefinition(
          parsedPolicy.data,
          member.policyVersion,
          now,
          true,
        );
        policyValid = true;
      } catch {
        /* A stale policy is held for review. */
      }
    }
    const policy = parsedPolicy.success ? parsedPolicy.data : null;
    if (member && !policy) return { status: "unavailable" };
    const membership =
      member && policy
        ? {
            id: member.id,
            campaignName: member.campaignName,
            policyVersion: member.policyVersion,
            status: member.status,
            provider: policy.provider,
            jurisdiction: policy.jurisdiction,
            basis: policy.permissionRequirement,
            offer: policy.offer,
            canRecord: !!(
              reviewStatus !== "excluded" &&
              source?.status === "current" &&
              source.proofProspectVersion === prospectVersion &&
              policyValid &&
              policy.offer &&
              policy.jurisdiction === member.country &&
              isSupportedPermission(
                policy.permissionRequirement,
                policy.provider,
                policy.jurisdiction,
              )
            ),
            permissionExpiresAt:
              member.permissionExpiresAt?.toISOString() ?? null,
            preparation: member.preparationStatus
              ? {
                  status: member.preparationStatus,
                  reason:
                    member.preparationReason &&
                    /^[a-z][a-z0-9_]{0,99}$/.test(member.preparationReason)
                      ? member.preparationReason
                      : null,
                }
              : null,
          }
        : null;
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
            requestId: source.requestId,
            contactVersion: source.proofContactVersion,
            prospectVersion: source.proofProspectVersion,
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
      membership,
      campaigns: campaigns.slice(0, 50),
      truncated: rows.length > 50,
    };
  } catch {
    return { status: "unavailable" };
  }
}
