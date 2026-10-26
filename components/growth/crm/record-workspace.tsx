import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getGrowthDb } from "@/lib/growth/db/client";
import { getCrmRecord } from "@/lib/growth/dashboard/crm-record";
import {
  getCrmWorkspace,
  type WorkspaceQuery,
} from "@/lib/growth/crm/workspace-query";
import { ActivityPanel } from "./activity-panel";
import { TaskPanel } from "./task-panel";
import { RecordProperties } from "./record-properties";
import styles from "./crm.module.css";

type SearchParams = Record<string, string | string[] | undefined>;
export function workspaceHref(
  basePath: string,
  query: WorkspaceQuery,
  overrides: Partial<WorkspaceQuery>,
  section: string,
): string {
  const params = new URLSearchParams();
  const merged = { ...query, ...overrides };
  if (merged.taskStatus && merged.taskStatus !== "open")
    params.set("taskStatus", merged.taskStatus);
  if (merged.activityAfter) params.set("activityAfter", merged.activityAfter);
  if (merged.taskAfter) params.set("taskAfter", merged.taskAfter);
  return `${basePath}${params.size ? "?" + params.toString() : ""}#${section}`;
}
export function parseWorkspaceQuery(params: SearchParams): WorkspaceQuery {
  const first = (key: string) => {
    const raw = params[key];
    return typeof raw === "string" ? raw : raw?.[0];
  };
  const status = first("taskStatus");
  return {
    taskStatus: status === "completed" || status === "all" ? status : "open",
    activityAfter: first("activityAfter")?.slice(0, 400),
    taskAfter: first("taskAfter")?.slice(0, 400),
  };
}
export async function RecordWorkspace({
  prospectId,
  basePath,
  query,
}: {
  prospectId: string;
  basePath: string;
  query: WorkspaceQuery;
}) {
  let record: Awaited<ReturnType<typeof getCrmRecord>>;
  let workspace: Awaited<ReturnType<typeof getCrmWorkspace>>;
  try {
    const db = getGrowthDb();
    [record, workspace] = await Promise.all([
      getCrmRecord(db, prospectId),
      getCrmWorkspace(db, prospectId, query),
    ]);
  } catch {
    return (
      <section className={styles.error} role="alert">
        <p>CRM details could not load. Refresh to try again.</p>
        <p>Reference: {randomUUID()}</p>
        <Link href={basePath}>Reload record</Link>
      </section>
    );
  }
  if (!record) return null;
  const taskLinks = {
    open: workspaceHref(
      basePath,
      query,
      { taskStatus: "open", taskAfter: undefined },
      "record-tasks",
    ),
    completed: workspaceHref(
      basePath,
      query,
      { taskStatus: "completed", taskAfter: undefined },
      "record-tasks",
    ),
    all: workspaceHref(
      basePath,
      query,
      { taskStatus: "all", taskAfter: undefined },
      "record-tasks",
    ),
  };
  return (
    <div className={styles.workspace}>
      <nav aria-label="Record sections" className={styles.nav}>
        <a href="#record-overview">Overview</a>
        <a href="#record-activity">Activity</a>
        <a href="#record-tasks">Tasks</a>
      </nav>
      <RecordProperties record={record} />
      <div className={styles.grid}>
        <ActivityPanel
          prospectId={prospectId}
          activities={workspace.activities}
          moreHref={workspaceHref(
            basePath,
            query,
            { activityAfter: workspace.activities.nextCursor ?? undefined },
            "record-activity",
          )}
        />
        <TaskPanel
          prospectId={prospectId}
          prospectVersion={record.prospectVersion}
          tasks={workspace.tasks}
          taskStatus={query.taskStatus ?? "open"}
          now={new Date().toISOString()}
          links={taskLinks}
          moreHref={workspaceHref(
            basePath,
            query,
            { taskAfter: workspace.tasks.nextCursor ?? undefined },
            "record-tasks",
          )}
        />
      </div>
    </div>
  );
}
