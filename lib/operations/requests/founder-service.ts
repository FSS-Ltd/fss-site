import { canTransition } from "./transitions";
import { z } from "zod";
import { withAgreementTransaction } from "../agreements/repository";
import type { OperationsFounder } from "../organisations/types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { addOperationsBusinessDays } from "../business-calendar";
import {
  founderRequestCommandSchema,
  type FounderRequestCommand,
} from "./validation";
import {
  RequestConflict,
  type RequestCommandResult,
  type RequestStatus,
} from "./types";
import { translateRequestError } from "./errors";
export async function applyRequestCommand(
  tx: OperationsTransaction,
  org: string,
  c: FounderRequestCommand,
): Promise<void> {
  const id = c.requestId;
  switch (c.action) {
    case "set_priority":
      await tx`update operations.requests set priority=${c.priority},version=version+1 where organisation_id=${org} and id=${id}`;
      break;
    case "classify_scope":
      await tx`update operations.requests set scope=${c.scope},scope_reason=${c.scopeReason},agreement_id=${c.agreementId},version=version+1 where organisation_id=${org} and id=${id}`;
      break;
    case "acknowledge":
      await tx`update operations.requests set status='acknowledged',owner_display=${c.ownerDisplay},delivery_owner_id=${c.deliveryOwnerId},scope=${c.scope},scope_reason=${c.scopeReason},version=version+1 where organisation_id=${org} and id=${id}`;
      break;
    case "plan":
      await tx`update operations.requests set status='planned',next_action=${c.nextAction},target_date=${c.targetDate},agreement_id=${c.agreementId},version=version+1 where organisation_id=${org} and id=${id}`;
      break;
    case "start":
      await tx`update operations.requests set status='in_progress',capacity_override_reason=${c.capacityOverrideReason},version=version+1 where organisation_id=${org} and id=${id}`;
      break;
    case "revise":
      await tx`update operations.requests set status=${c.revisionDecision === "included" ? "in_progress" : "changes_requested"},scope=${c.revisionDecision},scope_reason=${c.reason},capacity_override_reason=${c.capacityOverrideReason},version=version+1 where organisation_id=${org} and id=${id}`;
      break;
    case "review": {
      const deadline = addOperationsBusinessDays(new Date(), 3).toISOString();
      await tx`update operations.requests set status='ready_for_review',deliverable_version=${c.deliverableVersion},review_instructions=${c.reviewInstructions},public_summary=${c.publicSummary},review_reminder_target=${deadline}::timestamptz,version=version+1 where organisation_id=${org} and id=${id}`;
      await tx`insert into operations.request_reviews(organisation_id,request_id,review_cycle,deliverable_version,decision,feedback) select organisation_id,id,review_cycle,deliverable_version,'requested',public_summary from operations.requests where organisation_id=${org} and id=${id}`;
      for (const documentId of c.documentIds)
        await tx`insert into operations.request_documents(organisation_id,request_id,document_id,review_cycle,deliverable_version) select organisation_id,id,${documentId},review_cycle,deliverable_version from operations.requests where organisation_id=${org} and id=${id} on conflict do nothing`;
      break;
    }
    case "cancel":
    case "close":
      await tx`update operations.requests set status=${c.action === "cancel" ? "cancelled" : "done"},closure_label=${c.action === "cancel" ? "Cancelled by FSS" : "Closed by FSS"},transition_reason=${c.reason},blocked_since=null,blocked_reason=null,blocked_responsible_party=null,blocked_next_check_date=null,version=version+1 where organisation_id=${org} and id=${id}`;
      break;
    case "reopen":
      await tx`update operations.requests set status='acknowledged',delivery_owner_id=coalesce(delivery_owner_id,'00000000-0000-4000-8000-000000000001'::uuid),owner_display=case when owner_display='' then 'FSS' else owner_display end,transition_reason=${c.reason},scope='assessment_pending',scope_reason=${c.reason},review_cycle=review_cycle+1,deliverable_version=null,review_instructions='',public_summary='',review_reminder_target=null,closure_label=null,version=version+1 where organisation_id=${org} and id=${id}`;
      break;
    case "block":
      await tx`update operations.requests set blocked_since=${c.blocked ? new Date().toISOString() : null}::timestamptz,blocked_reason=${c.blocked?.reason ?? null},blocked_responsible_party=${c.blocked?.responsibleParty ?? null},blocked_next_check_date=${c.blocked?.nextCheckDate ?? null},version=version+1 where organisation_id=${org} and id=${id}`;
      break;
    case "comment":
      await tx`insert into operations.request_comments(organisation_id,request_id,body,visibility,author_label) values(${org},${id},${c.body},${c.visibility},'FSS')`;
      await bump(tx, org, id);
      break;
    case "designate_reviewer":
      if (c.enabled)
        await tx`insert into operations.request_reviewers(organisation_id,request_id,user_id) values(${org},${id},${c.userId}) on conflict do nothing`;
      else
        await tx`delete from operations.request_reviewers where organisation_id=${org} and request_id=${id} and user_id=${c.userId}`;
      await bump(tx, org, id);
      break;
    case "allowance":
      await tx`insert into operations.request_allowance_adjustments(organisation_id,request_id,unit,amount,reason,approval_reference) values(${org},${id},${c.unit},${c.amount},${c.reason},${c.approvalReference})`;
      await bump(tx, org, id);
      break;
  }
}
async function bump(
  tx: OperationsTransaction,
  org: string,
  id: string,
): Promise<void> {
  await tx`update operations.requests set version=version+1 where organisation_id=${org} and id=${id}`;
}
export async function executeFounderRequestCommand(
  db: OperationsDb,
  founder: OperationsFounder | null,
  organisationId: string,
  raw: unknown,
  correlationId: string,
): Promise<RequestCommandResult> {
  z.uuid().parse(organisationId);
  z.uuid().parse(correlationId);
  const command = founderRequestCommandSchema.parse(raw);
  try {
    return await withAgreementTransaction(db, founder, (tx) =>
      runRequestCommand(tx, organisationId, command, correlationId),
    );
  } catch (error) {
    translateRequestError(error);
  }
}

// Shared conflict/state checks and mutation for the founder and staff command
// services. Callers provide the transaction with its audit actor already set.
export async function runRequestCommand(
  tx: OperationsTransaction,
  organisationId: string,
  command: FounderRequestCommand,
  correlationId: string,
): Promise<RequestCommandResult> {
  z.uuid().parse(correlationId);
  await tx`select set_config('operations.correlation_id',${correlationId},true),set_config('operations.request_action',${command.action},true)`;
  const [current] = await tx<
    { version: number; status: RequestStatus }[]
  >`select version,status from operations.requests where organisation_id=${organisationId} and id=${command.requestId} for update`;
  if (!current || current.version !== command.expectedVersion)
    throw new RequestConflict();
  const expected: Partial<Record<FounderRequestCommand["action"], string>> = {
    acknowledge: "new",
    plan: "acknowledged",
    start: "planned",
    review: "in_progress",
    revise: "changes_requested",
    reopen: "done",
  };
  if (expected[command.action] && current.status !== expected[command.action])
    throw new RequestConflict(
      "This action is unavailable in the current state.",
    );
  if (
    command.action === "classify_scope" &&
    ["in_progress", "ready_for_review"].includes(current.status)
  )
    throw new RequestConflict("Reclassify scope before starting delivery.");
  if (
    ["cancel", "close", "classify_scope", "block"].includes(
      command.action,
    ) &&
    ["done", "cancelled"].includes(current.status)
  )
    throw new RequestConflict("This request is already closed.");
  const targets: Partial<
    Record<FounderRequestCommand["action"], RequestStatus>
  > = {
    acknowledge: "acknowledged",
    plan: "planned",
    start: "in_progress",
    review: "ready_for_review",
    cancel: "cancelled",
    reopen: "acknowledged",
  };
  const target = targets[command.action];
  if (target && !canTransition(current.status, target))
    throw new RequestConflict("This transition is unavailable.");
  await applyRequestCommand(tx, organisationId, command);
  return { id: command.requestId, version: current.version + 1 };
}
