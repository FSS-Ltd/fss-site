import type { GrowthTransaction } from "../db/types";
import { appendCrmActivity, requireCrmProspect } from "./activity-service";
import { CrmError } from "./errors";
import type { CrmCommand, CrmCommandResult } from "./schemas";

type TaskCommand = Extract<
  CrmCommand,
  { kind: "create_task" | "update_task" | "task_status" | "promote_task" }
>;
export async function executeTaskCommand(
  tx: GrowthTransaction,
  command: TaskCommand,
  actorId: string,
): Promise<CrmCommandResult> {
  const prospect = await requireCrmProspect(tx, command.prospectId);
  if (command.kind === "create_task") {
    const [created] =
      await tx`insert into growth.crm_tasks(id,prospect_id,title,due_at) values (${command.requestId},${command.prospectId},${command.title},${command.dueAt}) on conflict(id) do nothing returning id`;
    if (!created) {
      const [existing] =
        await tx`select id from growth.crm_tasks where id=${command.requestId} and prospect_id=${command.prospectId}`;
      if (!existing) throw new CrmError("not_found");
      return {
        prospectId: command.prospectId,
        recordId: command.requestId,
        alreadyExisted: true,
      };
    }
    await appendCrmActivity(tx, {
      prospectId: command.prospectId,
      actorId,
      type: "task_created",
      body: command.title,
      taskId: command.requestId,
    });
    return { prospectId: command.prospectId, recordId: command.requestId };
  }
  const [task] = await tx<
    {
      id: string;
      title: string;
      dueAt: Date;
      completedAt: Date | null;
      version: number;
    }[]
  >`select id,title,due_at as "dueAt",completed_at as "completedAt",version from growth.crm_tasks where id=${command.taskId} and prospect_id=${command.prospectId} for update`;
  if (!task) throw new CrmError("not_found");
  if (task.version !== command.expectedVersion)
    throw new CrmError("version_conflict");
  let type: string;
  let body = task.title;
  switch (command.kind) {
    case "update_task":
      await tx`update growth.crm_tasks set title=${command.title},due_at=${command.dueAt},version=version+1,updated_at=now() where id=${task.id}`;
      type = "task_updated";
      body = command.title;
      break;
    case "task_status":
      await tx`update growth.crm_tasks set completed_at=${command.completed ? new Date() : null},version=version+1,updated_at=now() where id=${task.id}`;
      type = command.completed ? "task_completed" : "task_reopened";
      break;
    case "promote_task":
      if (task.completedAt) throw new CrmError("invalid");
      if (prospect.version !== command.prospectVersion)
        throw new CrmError("version_conflict");
      await tx`update growth.prospects set next_action=${task.title},next_action_due_at=${task.dueAt},version=version+1,updated_at=now() where id=${prospect.id}`;
      await tx`update growth.crm_tasks set version=version+1,updated_at=now() where id=${task.id}`;
      type = "next_step";
      break;
  }
  await appendCrmActivity(tx, {
    prospectId: command.prospectId,
    actorId,
    type,
    body,
    taskId: task.id,
  });
  return { prospectId: command.prospectId, recordId: task.id };
}
