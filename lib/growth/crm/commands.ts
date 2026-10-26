import { appendAuditEvent } from "../audit/service";
import type { FounderSession } from "../auth/require-founder";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb } from "../db/types";
import { CrmError } from "./errors";
import { appendCrmActivity, requireCrmProspect } from "./activity-service";
import { executeTaskCommand } from "./task-service";
import { executeViewCommand } from "./view-service";
import { attachCrmContact, createCrmOpportunity } from "./opportunity-service";
import { captureLead } from "./lead-service";
import { updateCrmRecord } from "./record-service";
import {
  crmCommandSchema,
  type CrmCommand,
  type CrmCommandResult,
} from "./schemas";

export async function executeCrmCommand(
  db: GrowthDb,
  raw: CrmCommand,
  founder: FounderSession,
  correlationId: string,
): Promise<CrmCommandResult> {
  const command = crmCommandSchema.parse(raw);
  if (
    !/^[a-f0-9]{64}$/.test(founder.actorId) ||
    founder.email !== "j.ntagengwa@faithfulsoftware.dev"
  )
    throw new CrmError("invalid");
  try {
    return await withGrowthTransaction(db, async (tx) => {
      let result: CrmCommandResult;
      switch (command.kind) {
        case "capture":
          result = await captureLead(tx, command, founder, correlationId);
          break;
        case "update_prospect":
        case "update_business":
        case "update_contact":
        case "update_opportunity":
          result = await updateCrmRecord(tx, command);
          break;
        case "attach_contact":
          result = await attachCrmContact(tx, command);
          break;
        case "create_opportunity":
          result = await createCrmOpportunity(tx, command);
          break;
        case "add_activity":
          await requireCrmProspect(tx, command.prospectId);
          result = await appendCrmActivity(tx, {
            id: command.requestId,
            prospectId: command.prospectId,
            actorId: founder.actorId,
            type: command.activityType,
            body: command.body,
          });
          break;
        case "create_task":
        case "update_task":
        case "task_status":
        case "promote_task":
          result = await executeTaskCommand(tx, command, founder.actorId);
          break;
        case "save_view":
        case "rename_view":
        case "delete_view":
          result = await executeViewCommand(tx, command, founder.actorId);
          break;
      }
      if (!result.alreadyExisted)
        await appendAuditEvent(tx, {
          correlationId,
          actorType: "founder",
          actorId: founder.actorId,
          action: `crm.${command.kind}`,
          entityType: result.prospectId ? "prospect" : "crm_record",
          entityId: commandResultId(result),
        });
      return result;
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    )
      throw new CrmError(
        command.kind === "save_view" || command.kind === "rename_view"
          ? "duplicate_view"
          : "duplicate",
      );
    throw error;
  }
}

function commandResultId(result: CrmCommandResult): string {
  if (result.prospectId !== undefined) return result.prospectId;
  return result.recordId;
}
