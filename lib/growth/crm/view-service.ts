import type { GrowthTransaction } from "../db/types";
import { CrmError } from "./errors";
import type { CrmCommand, CrmCommandResult } from "./schemas";

type ViewCommand = Extract<
  CrmCommand,
  { kind: "save_view" | "rename_view" | "delete_view" }
>;
export async function executeViewCommand(
  tx: GrowthTransaction,
  command: ViewCommand,
  actorId: string,
): Promise<CrmCommandResult> {
  await tx`select pg_advisory_xact_lock(hashtextextended(${actorId},0))`;
  if (command.kind === "save_view") {
    const [existing] =
      await tx`select id from growth.crm_saved_views where id=${command.requestId} and actor_id=${actorId}`;
    if (existing) return { recordId: command.requestId, alreadyExisted: true };
    const [count] = await tx<
      { count: number }[]
    >`select count(*)::int count from growth.crm_saved_views where actor_id=${actorId}`;
    if (count.count >= 30) throw new CrmError("invalid");
    await tx`insert into growth.crm_saved_views(id,actor_id,name,filters) values (${command.requestId},${actorId},${command.name},${tx.json(command.filters)})`;
    return { recordId: command.requestId };
  }
  const [view] = await tx<
    { version: number }[]
  >`select version from growth.crm_saved_views where id=${command.viewId} and actor_id=${actorId} for update`;
  if (!view) throw new CrmError("not_found");
  if (view.version !== command.expectedVersion)
    throw new CrmError("version_conflict");
  if (command.kind === "delete_view")
    await tx`delete from growth.crm_saved_views where id=${command.viewId} and actor_id=${actorId}`;
  else
    await tx`update growth.crm_saved_views set name=${command.name},version=version+1,updated_at=now() where id=${command.viewId} and actor_id=${actorId}`;
  return { recordId: command.viewId };
}
