import { randomUUID } from "node:crypto";
import { appendAuditEvent } from "../audit/service";
import type { FounderSession } from "../auth/require-founder";
import type { GrowthTransaction } from "../db/types";
import { requireCampaignFounder } from "./authorization";
import type { CampaignCommand } from "./schemas";

export type CampaignMutation = {
  campaignId: string;
  version: number;
  membershipId: string | null;
  resultId: string;
};
export async function appendCampaignEventAndOutbox(
  tx: GrowthTransaction,
  input: CampaignMutation & {
    requestId: string;
    requestHash: string;
    type: CampaignCommand["type"];
    founder: FounderSession;
    correlationId: string;
    replyReview?: {
      inboundMessageId: string;
      kind: Extract<CampaignCommand, { type: "record_reply" }>["kind"];
    };
  },
): Promise<void> {
  requireCampaignFounder(input.founder);
  if (!input.correlationId.trim()) throw new Error("invalid_correlation_id");
  await tx`insert into growth.outreach_events(id,campaign_id,policy_version,membership_id,event_type,request_id,request_hash,actor_id,result_id,review_inbound_message_id,review_reply_kind) values (${input.requestId},${input.campaignId},${input.version},${input.membershipId},${input.type},${input.requestId},${input.requestHash},${input.founder.actorId},${input.resultId},${input.replyReview?.inboundMessageId ?? null},${input.replyReview?.kind ?? null})`;
  await tx`insert into growth.outreach_outbox(id,event_id) values (${randomUUID()},${input.requestId})`;
  await appendAuditEvent(tx, {
    correlationId: input.correlationId,
    actorType: "founder",
    actorId: input.founder.actorId,
    action: `campaign.${input.type}`,
    entityType: input.membershipId ? "campaign_membership" : "campaign",
    entityId: input.membershipId ?? input.campaignId,
  });
}
