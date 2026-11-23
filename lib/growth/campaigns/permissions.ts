import { createHash } from "node:crypto";
import type { FounderSession } from "../auth/require-founder";
import type { GrowthTransaction } from "../db/types";
import { requireCampaignFounder } from "./authorization";
import { appendCampaignEventAndOutbox } from "./events";
import { loadFounderSourceProof } from "./founder-verification-reader";
import { validPermissionEvidence } from "./permission-evidence";
import { loadLatestCampaignPolicy } from "./repository";
import { campaignCommandSchema, type CampaignCommand } from "./schemas";

type PermissionCommand = Extract<
  CampaignCommand,
  { type: "record_permission" }
>;

export async function enqueueFirstPreparation(
  tx: GrowthTransaction,
  eventId: string,
): Promise<void> {
  const key = `first-preparation:${eventId}`;
  await tx`
    insert into growth.outreach_jobs(campaign_id,policy_version,membership_id,outbox_id,job_type,due_at,idempotency_key)
    select e.campaign_id,e.policy_version,e.membership_id,o.id,'first_preparation',clock_timestamp(),${key}
    from growth.outreach_events e join growth.outreach_outbox o on o.event_id=e.id
    join growth.campaign_memberships m on m.id=e.membership_id and m.campaign_id=e.campaign_id and m.policy_version=e.policy_version
    join growth.campaigns c on c.id=e.campaign_id and c.version=e.policy_version
    join growth.outreach_permissions p on p.id=e.result_id and p.membership_id=e.membership_id and p.id=m.current_permission_id
    where e.id=${eventId} and e.event_type='record_permission' and p.provider in ('gmail','resend')
      and c.account_connection_id is not null and c.policy->>'provider'=p.provider
    on conflict (idempotency_key) do nothing`;
  const [conflict] = await tx<{ conflict: boolean }[]>`
    select exists(select 1 from growth.outreach_jobs j left join growth.outreach_outbox o on o.id=j.outbox_id
      left join growth.outreach_events e on e.id=o.event_id
      where j.idempotency_key=${key} and (j.job_type<>'first_preparation' or e.id is distinct from ${eventId}::uuid
        or j.campaign_id is distinct from e.campaign_id or j.policy_version is distinct from e.policy_version
        or j.membership_id is distinct from e.membership_id)) as conflict`;
  if (conflict?.conflict) throw new Error("preparation_job_conflict");
}
export async function recordCampaignPermission(
  tx: GrowthTransaction,
  raw: PermissionCommand,
  founder: FounderSession,
  correlationId: string,
): Promise<{
  campaignId: string;
  version: number;
  membershipId: string;
  resultId: string;
}> {
  requireCampaignFounder(founder);
  if (!correlationId.trim()) throw new Error("invalid_command");
  const command = campaignCommandSchema.parse(raw);
  if (command.type !== "record_permission") throw new Error("invalid_command");
  const requestHash = createHash("sha256")
    .update(JSON.stringify(command))
    .digest("hex");
  await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:campaign-command:${command.requestId}`},0))`;
  const [previous] = await tx<
    {
      requestHash: string;
      actorId: string;
      campaignId: string;
      version: number;
      membershipId: string;
      resultId: string;
    }[]
  >`select request_hash as "requestHash",actor_id as "actorId",campaign_id as "campaignId",policy_version as version,membership_id as "membershipId",result_id as "resultId" from growth.outreach_events where request_id=${command.requestId} and event_type='record_permission'`;
  if (previous) {
    if (
      previous.requestHash !== requestHash ||
      previous.actorId !== founder.actorId ||
      previous.membershipId !== command.membershipId ||
      previous.resultId !== command.evidenceId
    )
      throw new Error("request_conflict");
    await enqueueFirstPreparation(tx, command.requestId);
    return {
      campaignId: previous.campaignId,
      version: previous.version,
      membershipId: previous.membershipId,
      resultId: previous.resultId,
    };
  }
  const [identity] = await tx<
    { campaignId: string }[]
  >`select campaign_id as "campaignId" from growth.campaign_memberships where id=${command.membershipId}`;
  if (!identity) throw new Error("membership_unavailable");
  await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:campaign:${identity.campaignId}`},0))`;
  const [member] = await tx<
    {
      campaignId: string;
      version: number;
      prospectId: string;
      status: string;
    }[]
  >`select campaign_id as "campaignId",policy_version as version,prospect_id as "prospectId",status from growth.campaign_memberships where id=${command.membershipId} for update`;
  if (
    !member ||
    member.campaignId !== identity.campaignId ||
    !["review", "active", "paused"].includes(member.status)
  )
    throw new Error("membership_unavailable");
  const policy = await loadLatestCampaignPolicy(tx, member.campaignId, founder);
  if (
    !policy ||
    policy.version !== member.version ||
    policy.status === "revoked"
  )
    throw new Error("policy_version_changed");
  const [prospect] = await tx<
    { version: number; contactId: string | null; country: string }[]
  >`select p.version,p.primary_contact_id as "contactId",b.country_code as country from growth.prospects p join growth.businesses b on b.id=p.business_id where p.id=${member.prospectId} for update of p`;
  if (
    !prospect ||
    !prospect.contactId ||
    prospect.version !== command.expectedProspectVersion
  )
    throw new Error("prospect_version_changed");
  const [contact] = await tx<
    { version: number }[]
  >`select version from growth.contacts where id=${prospect.contactId} for update`;
  if (!contact || contact.version !== command.expectedContactVersion)
    throw new Error("contact_version_changed");
  const now = new Date();
  if (!!command.proofRequestId === !!command.researchProofId)
    throw new Error("verification_required");
  const reference = command.proofRequestId
    ? { origin: "founder" as const, requestId: command.proofRequestId }
    : command.researchProofId
      ? { origin: "research" as const, bindingId: command.researchProofId }
      : null;
  if (!reference) throw new Error("verification_required");
  const proof = await loadFounderSourceProof(
    tx,
    member.prospectId,
    now,
    founder,
    reference,
  );
  if (
    !proof ||
    proof.contactId !== prospect.contactId ||
    proof.proofContactVersion !== contact.version ||
    proof.proofProspectVersion !== prospect.version
  )
    throw new Error("verification_required");
  if (
    command.provider !== policy.definition.provider ||
    command.basis !== policy.definition.permissionRequirement ||
    command.jurisdiction !== policy.definition.jurisdiction ||
    command.jurisdiction !== prospect.country ||
    command.observedAt > now ||
    command.expiresAt <= now ||
    command.observedAt >= command.expiresAt
  )
    throw new Error("permission_invalid");
  const evidence = {
    summary: command.summary,
    reference: command.reference,
    observedAt: command.observedAt.toISOString(),
    explicitOptIn: command.explicitOptIn,
    ...(command.requestedService
      ? {
          requestedService: {
            ...command.requestedService,
            requestedAt: command.requestedService.requestedAt.toISOString(),
          },
        }
      : {}),
  };
  if (
    !validPermissionEvidence({
      basis: command.basis,
      provider: command.provider,
      jurisdiction: command.jurisdiction,
      offer: policy.definition.offer,
      now,
      evidence,
    })
  )
    throw new Error("permission_invalid");
  await tx`insert into growth.outreach_permissions (id,membership_id,basis,provider,jurisdiction,expires_at,actor_id,evidence,contact_id,proof_request_id,contact_version,prospect_version,proof_origin,research_proof_id) values (${command.evidenceId},${command.membershipId},${command.basis},${command.provider},${command.jurisdiction},${command.expiresAt},${founder.actorId},${tx.json(evidence)},${prospect.contactId},${command.proofRequestId ?? null},${contact.version},${prospect.version},${reference.origin},${command.researchProofId ?? null})`;
  await tx`update growth.campaign_memberships set current_permission_id=${command.evidenceId},updated_at=now() where id=${command.membershipId}`;
  await appendCampaignEventAndOutbox(tx, {
    campaignId: member.campaignId,
    version: member.version,
    membershipId: command.membershipId,
    resultId: command.evidenceId,
    requestId: command.requestId,
    requestHash,
    type: "record_permission",
    founder,
    correlationId,
  });
  await enqueueFirstPreparation(tx, command.requestId);
  return {
    campaignId: member.campaignId,
    version: member.version,
    membershipId: command.membershipId,
    resultId: command.evidenceId,
  };
}
