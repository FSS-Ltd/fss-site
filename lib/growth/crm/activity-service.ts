import { randomUUID } from "node:crypto";
import type { GrowthTransaction } from "../db/types";
import { CrmError } from "./errors";
import type { CrmCommandResult } from "./schemas";

export async function appendCrmActivity(
  tx: GrowthTransaction,
  input: {
    prospectId: string;
    actorId: string;
    type: string;
    body: string;
    id?: string;
    taskId?: string;
  },
): Promise<CrmCommandResult> {
  const id = input.id ?? randomUUID();
  const [inserted] =
    await tx`insert into growth.crm_activities(id,prospect_id,activity_type,body,task_id,actor_id)
  values (${id},${input.prospectId},${input.type},${input.body},${input.taskId ?? null},${input.actorId}) on conflict(id) do nothing returning id`;
  if (!inserted) {
    const [existing] =
      await tx`select id from growth.crm_activities where id=${id} and prospect_id=${input.prospectId} and actor_id=${input.actorId}`;
    if (!existing) throw new CrmError("not_found");
  }
  return {
    prospectId: input.prospectId,
    recordId: id,
    alreadyExisted: !inserted,
  };
}
export async function requireCrmProspect(
  tx: GrowthTransaction,
  prospectId: string,
): Promise<{ id: string; version: number }> {
  const [prospect] = await tx<
    { id: string; version: number }[]
  >`select id,version from growth.prospects where id=${prospectId} for update`;
  if (!prospect) throw new CrmError("not_found");
  return prospect;
}
