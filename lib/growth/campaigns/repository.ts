import { createHash } from "node:crypto";
import type { FounderSession } from "../auth/require-founder";
import { requireCampaignFounder } from "./authorization";
import { appendCampaignEventAndOutbox } from "./events";
import type { GrowthQueryExecutor, GrowthTransaction } from "../db/types";
import {
  campaignPolicyDefinitionSchema,
  campaignCommandSchema,
  campaignPolicySchema,
  type CampaignPolicy,
  type CampaignPolicyDefinition,
} from "./schemas";

export type StoredCampaignPolicy = {
  id: string;
  version: number;
  name: string;
  status: "paused" | "approved" | "revoked";
  approvedBy: string | null;
  approvedAt: Date | null;
  definition: CampaignPolicyDefinition;
};
export async function loadLatestCampaignPolicy(
  db: GrowthQueryExecutor,
  campaignId: string,
  founder: FounderSession,
): Promise<StoredCampaignPolicy | null> {
  requireCampaignFounder(founder);
  const [row] = await db<
    {
      id: string;
      version: number;
      name: string;
      status: "paused" | "approved" | "revoked";
      approvedBy: string | null;
      approvedAt: Date | null;
      policy: unknown;
    }[]
  >`select id,version,name,status,approved_by as "approvedBy",approved_at as "approvedAt",policy from growth.campaigns where id=${campaignId} order by version desc limit 1`;
  return row
    ? {
        id: row.id,
        version: row.version,
        name: row.name,
        status: row.status,
        approvedBy: row.approvedBy,
        approvedAt: row.approvedAt,
        definition: campaignPolicyDefinitionSchema.parse(row.policy),
      }
    : null;
}
export async function loadCampaignPolicyVersion(
  db: GrowthQueryExecutor,
  campaignId: string,
  version: number,
  founder: FounderSession,
): Promise<StoredCampaignPolicy | null> {
  requireCampaignFounder(founder);
  const [row] = await db<
    {
      id: string;
      version: number;
      name: string;
      status: "paused" | "approved" | "revoked";
      approvedBy: string | null;
      approvedAt: Date | null;
      policy: unknown;
    }[]
  >`select id,version,name,status,approved_by as "approvedBy",approved_at as "approvedAt",policy from growth.campaigns where id=${campaignId} and version=${version}`;
  return row
    ? {
        id: row.id,
        version: row.version,
        name: row.name,
        status: row.status,
        approvedBy: row.approvedBy,
        approvedAt: row.approvedAt,
        definition: campaignPolicyDefinitionSchema.parse(row.policy),
      }
    : null;
}
export function projectCampaignPolicy(
  row: StoredCampaignPolicy,
): CampaignPolicy {
  return campaignPolicySchema.parse({
    ...row.definition,
    status: row.status,
    approvedAt: row.approvedAt,
    approverId: row.approvedBy,
  });
}
export type CampaignMembershipInput = {
  campaignId: string;
  policyVersion: number;
  prospectId: string;
  requestId: string;
  founder: FounderSession;
  correlationId: string;
};
export type CampaignMembershipResult = {
  membershipId: string;
  businessId: string;
};
export async function persistCampaignMembership(
  tx: GrowthTransaction,
  input: CampaignMembershipInput,
): Promise<CampaignMembershipResult> {
  requireCampaignFounder(input.founder);
  if (!input.correlationId.trim()) throw new Error("invalid_command");
  const command = campaignCommandSchema.parse({
    type: "enrol",
    requestId: input.requestId,
    campaignId: input.campaignId,
    policyVersion: input.policyVersion,
    prospectId: input.prospectId,
  });
  const requestHash = createHash("sha256")
    .update(JSON.stringify(command))
    .digest("hex");
  await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:campaign-command:${input.requestId}`},0))`;
  const [previous] = await tx<
    {
      requestHash: string;
      actorId: string;
      membershipId: string;
      businessId: string;
      campaignId: string;
      policyVersion: number;
      prospectId: string;
    }[]
  >`select e.request_hash as "requestHash",e.actor_id as "actorId",m.id as "membershipId",m.business_id as "businessId",m.campaign_id as "campaignId",m.policy_version as "policyVersion",m.prospect_id as "prospectId" from growth.outreach_events e join growth.campaign_memberships m on m.id=e.membership_id where e.request_id=${input.requestId} and e.event_type='enrol'`;
  if (previous) {
    if (
      previous.requestHash !== requestHash ||
      previous.actorId !== input.founder.actorId ||
      previous.campaignId !== input.campaignId ||
      previous.policyVersion !== input.policyVersion ||
      previous.prospectId !== input.prospectId
    )
      throw new Error("request_conflict");
    return {
      membershipId: previous.membershipId,
      businessId: previous.businessId,
    };
  }
  await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:campaign:${input.campaignId}`},0))`;
  const [policy] = await tx<
    { version: number; status: string }[]
  >`select version,status from growth.campaigns where id=${input.campaignId} order by version desc limit 1`;
  if (
    !policy ||
    policy.version !== input.policyVersion ||
    policy.status === "revoked"
  )
    throw new Error("policy_version_changed");
  const [identity] = await tx<
    { businessId: string }[]
  >`select business_id as "businessId" from growth.prospects where id=${input.prospectId}`;
  if (!identity) throw new Error("prospect_not_found");
  await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:outreach-business:${identity.businessId}`},0))`;
  const [prospect] = await tx<
    {
      businessId: string;
      status: string;
      isClient: boolean;
      suppressed: boolean;
    }[]
  >`select p.business_id as "businessId", p.status, growth.is_outreach_client(p.id) as "isClient", exists(select 1 from growth.suppressions s left join growth.contacts c on c.id=p.primary_contact_id where s.business_id=p.business_id or s.normalised_email=c.normalised_email or s.normalised_email=lower(trim(p.source_details->>'email'))) as suppressed from growth.prospects p where p.id=${input.prospectId} for update`;
  if (!prospect || prospect.businessId !== identity.businessId)
    throw new Error("identity_changed");
  if (
    prospect.isClient ||
    prospect.suppressed ||
    ["suppressed", "rejected", "won", "lost"].includes(prospect.status)
  )
    throw new Error("excluded");
  const [conflict] = await tx<
    { found: boolean }[]
  >`select exists(select 1 from growth.campaign_memberships where business_id=${identity.businessId} and status in ('review','active','paused')) or exists(select 1 from growth.sequence_enrollments se join growth.prospects p on p.id=se.prospect_id where p.business_id=${identity.businessId} and se.status in ('pending_approval','active','paused')) as found`;
  if (conflict?.found) throw new Error("active_membership_exists");
  const [created] = await tx<
    { id: string }[]
  >`insert into growth.campaign_memberships (campaign_id,policy_version,business_id,prospect_id,request_id,status) values (${input.campaignId},${input.policyVersion},${identity.businessId},${input.prospectId},${input.requestId},'review') returning id`;
  if (!created) throw new Error("membership_insert_failed");
  await appendCampaignEventAndOutbox(tx, {
    campaignId: input.campaignId,
    version: input.policyVersion,
    membershipId: created.id,
    resultId: created.id,
    requestId: input.requestId,
    requestHash,
    type: "enrol",
    founder: input.founder,
    correlationId: input.correlationId,
  });
  return { membershipId: created.id, businessId: identity.businessId };
}
export const postgresCampaignRepository = {
  loadLatestCampaignPolicy,
  loadCampaignPolicyVersion,
  projectCampaignPolicy,
  persistCampaignMembership,
};
