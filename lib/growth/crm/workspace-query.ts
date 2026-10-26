import { z } from "zod";
import type { GrowthQueryExecutor } from "../db/types";
import { pipelineFiltersSchema, type PipelineFilters } from "./schemas";

const pageSize = 20;
const cursorSchema = z.object({
  at: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});
export type WorkspaceQuery = {
  activityAfter?: string;
  taskAfter?: string;
  taskStatus?: "open" | "completed" | "all";
};
export type CrmTask = {
  id: string;
  title: string;
  dueAt: string;
  completedAt: string | null;
  version: number;
};
export type CrmActivity = {
  id: string;
  type: string;
  body: string;
  taskId: string | null;
  createdAt: string;
};
export type SavedCrmView = {
  id: string;
  name: string;
  version: number;
  filters: PipelineFilters;
};
export type CrmWorkspace = {
  tasks: { rows: CrmTask[]; nextCursor: string | null };
  activities: { rows: CrmActivity[]; nextCursor: string | null };
};
function cursor(
  value: string | undefined,
): z.infer<typeof cursorSchema> | null {
  if (!value || value.length > 400) return null;
  try {
    const parsed = cursorSchema.safeParse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
function encode(at: string, id: string): string {
  return Buffer.from(JSON.stringify({ at, id })).toString("base64url");
}
export async function getCrmWorkspace(
  db: GrowthQueryExecutor,
  prospectId: string,
  query: WorkspaceQuery,
): Promise<CrmWorkspace> {
  const activityCursor = cursor(query.activityAfter);
  const taskCursor = cursor(query.taskAfter);
  const tasks = await db<
    {
      id: string;
      title: string;
      dueAt: Date;
      cursorAt: string;
      completedAt: Date | null;
      version: number;
    }[]
  >`select id,title,due_at as "dueAt",completed_at as "completedAt",version,to_char(due_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "cursorAt" from growth.crm_tasks
  where prospect_id=${prospectId}
  ${query.taskStatus === "all" ? db`` : query.taskStatus === "completed" ? db`and completed_at is not null` : db`and completed_at is null`}
  ${taskCursor ? db`and (due_at,id)>(${taskCursor.at}::text::timestamptz,${taskCursor.id}::uuid)` : db``}
  order by due_at,id limit ${pageSize + 1}`;
  const activities = await db<
    {
      id: string;
      type: string;
      body: string;
      taskId: string | null;
      createdAt: Date;
      cursorAt: string;
    }[]
  >`select *,to_char("createdAt" at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "cursorAt" from (
  select id,activity_type as type,body,task_id as "taskId",created_at as "createdAt" from growth.crm_activities where prospect_id=${prospectId}
  union all
  select e.id,'stage' as type,e.from_state || ' to ' || e.to_state || coalesce(': ' || e.reason_code,''),null::uuid,e.occurred_at
  from growth.commercial_stage_events e join growth.delivery_engagements d on d.id=e.engagement_id where d.prospect_id=${prospectId}
 ) activity ${activityCursor ? db`where ("createdAt",id)<(${activityCursor.at}::text::timestamptz,${activityCursor.id}::uuid)` : db``}
 order by "createdAt" desc,id desc limit ${pageSize + 1}`;
  const taskRows = tasks.slice(0, pageSize).map((row) => ({
    ...row,
    dueAt: row.dueAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  }));
  const activityRows = activities
    .slice(0, pageSize)
    .map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  const lastTask = tasks.slice(0, pageSize).at(-1);
  const lastActivity = activities.slice(0, pageSize).at(-1);
  return {
    tasks: {
      rows: taskRows,
      nextCursor:
        tasks.length > pageSize && lastTask
          ? encode(lastTask.cursorAt, lastTask.id)
          : null,
    },
    activities: {
      rows: activityRows,
      nextCursor:
        activities.length > pageSize && lastActivity
          ? encode(lastActivity.cursorAt, lastActivity.id)
          : null,
    },
  };
}
export async function getSavedCrmViews(
  db: GrowthQueryExecutor,
  actorId: string,
): Promise<SavedCrmView[]> {
  const rows = await db<
    { id: string; name: string; version: number; filters: unknown }[]
  >`select id,name,version,filters from growth.crm_saved_views where actor_id=${actorId} order by created_at,id limit 30`;
  return rows.flatMap((row) => {
    const parsed = pipelineFiltersSchema.safeParse(row.filters);
    return parsed.success ? [{ ...row, filters: parsed.data }] : [];
  });
}
