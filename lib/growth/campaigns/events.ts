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
  outcomeOccurredAt?: Date;
};
export async function appendCampaignEventAndOutbox(
  tx: GrowthTransaction,
  input: CampaignMutation & {
    requestId: string;
    requestHash: string;
    type: CampaignCommand["type"];
    founder: FounderSession;
    correlationId: string;
    outcomeReview?: {
      outcome: Extract<CampaignCommand, { type: "record_outcome" }>["outcome"];
      occurredAt: Date;
    };
    replyReview?: {
      inboundMessageId: string;
      kind: Extract<CampaignCommand, { type: "record_reply" }>["kind"];
    };
  },
): Promise<void> {
  requireCampaignFounder(input.founder);
  if (!input.correlationId.trim()) throw new Error("invalid_correlation_id");
  await tx`insert into growth.outreach_events(id,campaign_id,policy_version,membership_id,event_type,request_id,request_hash,actor_id,result_id,review_inbound_message_id,review_reply_kind,review_outcome_kind,review_outcome_at,review_meeting_activity_id,review_proposal_event_id,occurred_at) values (${input.requestId},${input.campaignId},${input.version},${input.membershipId},${input.type},${input.requestId},${input.requestHash},${input.founder.actorId},${input.resultId},${input.replyReview?.inboundMessageId ?? null},${input.replyReview?.kind ?? null},${input.outcomeReview?.outcome.kind ?? null},case when ${input.outcomeReview?.outcome.kind ?? null}='proposal' then (select occurred_at from growth.commercial_stage_events where id=${input.outcomeReview?.outcome.kind === "proposal" ? input.outcomeReview.outcome.stageEventId : null}::uuid) else ${input.outcomeReview?.occurredAt ?? null}::timestamptz end,${input.outcomeReview?.outcome.kind === "meeting" ? input.outcomeReview.outcome.crmActivityId : null},${input.outcomeReview?.outcome.kind === "proposal" ? input.outcomeReview.outcome.stageEventId : null},case when ${input.type} in ('record_outcome','record_reply') then clock_timestamp() else now() end)`;
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
