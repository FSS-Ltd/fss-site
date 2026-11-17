import { createHash, randomUUID } from "node:crypto";
import type { FounderSession } from "../auth/require-founder";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb, GrowthTransaction } from "../db/types";
import { requireCampaignFounder } from "./authorization";
import { appendCampaignEventAndOutbox, type CampaignMutation } from "./events";
import {
  cancelCampaignJobs,
  validateCampaignDefinition,
  serializeCampaignDefinition,
} from "./lifecycle";
import { recordCampaignPermission } from "./permissions";
import {
  loadLatestCampaignPolicy,
  persistCampaignMembership,
} from "./repository";
import {
  campaignCommandSchema,
  type CampaignCommand,
  type CampaignPolicyDefinition,
  type CampaignCommandResult,
} from "./schemas";

async function validateAccountBinding(
  tx: GrowthTransaction,
  policy: CampaignPolicyDefinition,
  founder: FounderSession,
): Promise<void> {
  if (!policy.accountConnectionId) return;
  if (policy.provider !== "gmail") throw new Error("invalid_account_binding");
  const [connection] = await tx<{ id: string }[]>`
    select id from growth.integration_connections
    where id = ${policy.accountConnectionId}
      and provider = 'gmail' and subject_email = ${founder.email}
      and status = 'connected' and google_subject is not null
      and 'https://www.googleapis.com/auth/gmail.modify' = any(granted_scopes)
    for share
  `;
  if (!connection) throw new Error("invalid_account_binding");
}

async function mutate(
  tx: GrowthTransaction,
  command: CampaignCommand,
  founder: FounderSession,
  correlationId: string,
): Promise<CampaignMutation> {
  if (
    command.type === "record_reply" ||
    command.type === "record_outcome" ||
    command.type === "raise_limit"
  )
    throw new Error("not_available");
  if (command.type === "create") {
    validateCampaignDefinition(command.policy, 1, new Date(), false);
    await validateAccountBinding(tx, command.policy, founder);
    const id = randomUUID();
    await tx`insert into growth.campaigns(id,version,request_id,name,policy,account_connection_id) values (${id},1,${command.requestId},${command.name},${tx.json(serializeCampaignDefinition(command.policy))},${command.policy.accountConnectionId})`;
    return { campaignId: id, version: 1, membershipId: null, resultId: id };
  }
  const membershipId =
    command.type === "record_permission" || command.type === "stop"
      ? command.membershipId
      : null;
  let campaignId: string;
  if (membershipId) {
    const [member] = await tx<
      { campaignId: string }[]
    >`select campaign_id as "campaignId" from growth.campaign_memberships where id=${membershipId}`;
    if (!member) throw new Error("membership_unavailable");
    campaignId = member.campaignId;
  } else if ("campaignId" in command) campaignId = command.campaignId;
  else throw new Error("invalid_command");
  await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:campaign:${campaignId}`},0))`;
  if (command.type === "record_permission")
    return recordCampaignPermission(tx, command, founder, correlationId);
  if (command.type === "stop") {
    const [member] = await tx<
      { version: number; status: string }[]
    >`select policy_version as version,status from growth.campaign_memberships where id=${command.membershipId} for update`;
    if (!member) throw new Error("membership_unavailable");
    if (!["review", "active", "paused", "stopped"].includes(member.status))
      throw new Error("membership_not_stoppable");
    if (member.status !== "stopped")
      await tx`update growth.campaign_memberships set status='stopped',updated_at=now() where id=${command.membershipId}`;
    await cancelCampaignJobs(tx, campaignId, command.membershipId);
    return {
      campaignId,
      version: member.version,
      membershipId: command.membershipId,
      resultId: command.membershipId,
    };
  }
  const now = new Date();
  const policy = await loadLatestCampaignPolicy(tx, campaignId, founder);
  if (!policy || policy.version !== command.policyVersion)
    throw new Error("policy_version_changed");
  if (policy.status === "revoked") throw new Error("policy_revoked");
  if (command.type === "revise") {
    validateCampaignDefinition(command.policy, policy.version + 1, now, false);
    await validateAccountBinding(tx, command.policy, founder);
    await tx`update growth.campaigns set status='paused' where id=${campaignId} and status='approved'`;
    await cancelCampaignJobs(tx, campaignId);
    await tx`insert into growth.campaigns(id,version,request_id,name,policy,account_connection_id) values (${campaignId},${policy.version + 1},${command.requestId},${policy.name},${tx.json(serializeCampaignDefinition(command.policy))},${command.policy.accountConnectionId})`;
    return {
      campaignId,
      version: policy.version + 1,
      membershipId: null,
      resultId: campaignId,
    };
  }
  if (command.type === "approve") {
    if (policy.approvedAt || policy.approvedBy)
      throw new Error("already_approved");
    validateCampaignDefinition(policy.definition, policy.version, now, true);
    await tx`update growth.campaigns set approved_by=${founder.actorId},approved_at=${now} where id=${campaignId} and version=${policy.version}`;
  } else if (command.type === "pause") {
    await tx`update growth.campaigns set status='paused' where id=${campaignId} and version=${policy.version}`;
    await cancelCampaignJobs(tx, campaignId);
  } else if (command.type === "resume") {
    if (!policy.approvedAt || !policy.approvedBy)
      throw new Error("policy_not_approved");
    validateCampaignDefinition(policy.definition, policy.version, now, true);
    throw new Error("provider_health_unknown");
  } else if (command.type === "enrol") {
    const member = await persistCampaignMembership(tx, {
      campaignId,
      policyVersion: policy.version,
      prospectId: command.prospectId,
      requestId: command.requestId,
      founder,
      correlationId,
    });
    return {
      campaignId,
      version: policy.version,
      membershipId: member.membershipId,
      resultId: member.membershipId,
    };
  }
  return {
    campaignId,
    version: policy.version,
    membershipId: null,
    resultId: campaignId,
  };
}

export async function executeCampaignCommand(
  db: GrowthDb,
  raw: CampaignCommand,
  founder: FounderSession,
  correlationId: string,
): Promise<Extract<CampaignCommandResult, { status: "ok" }>> {
  const command = campaignCommandSchema.parse(raw);
  requireCampaignFounder(founder);
  if (!correlationId.trim()) throw new Error("invalid_correlation_id");
  const requestHash = createHash("sha256")
    .update(JSON.stringify(command))
    .digest("hex");
  return withGrowthTransaction(db, async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:campaign-command:${command.requestId}`},0))`;
    const [previous] = await tx<
      {
        requestHash: string;
        actorId: string;
        resultId: string;
        version: number;
      }[]
    >`select request_hash as "requestHash",actor_id as "actorId",result_id as "resultId",policy_version as version from growth.outreach_events where request_id=${command.requestId}`;
    if (previous) {
      if (
        previous.requestHash !== requestHash ||
        previous.actorId !== founder.actorId
      )
        throw new Error("request_conflict");
      return {
        status: "ok",
        id: previous.resultId,
        version: previous.version,
        alreadyExisted: true,
      };
    }
    const outcome = await mutate(tx, command, founder, correlationId);
    if (command.type !== "enrol" && command.type !== "record_permission")
      await appendCampaignEventAndOutbox(tx, {
        ...outcome,
        requestId: command.requestId,
        requestHash,
        type: command.type,
        founder,
        correlationId,
      });
    return {
      status: "ok",
      id: outcome.resultId,
      version: outcome.version,
      alreadyExisted: false,
    };
  });
}
