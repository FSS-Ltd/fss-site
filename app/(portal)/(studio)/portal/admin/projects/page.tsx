import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import styles from "@/components/portal/studio-client.module.css";
import { PortalButton, PortalSelect } from "@/components/portal/ui";
import { StudioPagination } from "@/components/portal/workspace/studio-pagination";
import { studioDateLabel } from "@/components/portal/workspace/studio-date";
import workspace from "@/components/portal/workspace/workspace.module.css";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { parseWorkspacePage } from "@/lib/operations/workspaces/pagination";
import { listStaffProjects } from "@/lib/operations/workspaces/staff-repository";
import { projectStatusLabels } from "@/components/portal/project-summary";

export const dynamic = "force-dynamic";

const projectStatuses = [
  "planned",
  "active",
  "waiting_for_us",
  "waiting_for_you",
  "completed",
  "paused",
] as const;

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const params = await searchParams;
  const data = await (async () => {
    const db = getOperationsDb();
    const admin = await requireFssAdmin(db, identity, randomUUID());
    const page = parseWorkspacePage(params.page);
    const organisationId = Array.isArray(params.organisationId)
      ? undefined
      : params.organisationId;
    const rawStatus = Array.isArray(params.status) ? undefined : params.status;
    const status = rawStatus === "all" ? undefined : rawStatus;
    if (organisationId) z.uuid().parse(organisationId);
    const projects = await listStaffProjects(db, admin, {
      organisationId,
      status,
      page,
    });
    return { projects, organisationId, rawStatus, status };
  })().catch(() => null);
  if (!data) return <PortalUnavailable />;
  const { projects, organisationId, rawStatus, status } = data;
  return (
    <section className={styles.page} aria-labelledby="studio-projects-heading">
      <header className={styles.hero}>
        <p className={styles.eyebrow}>FSS Studio · Projects</p>
        <h1 className={styles.title} id="studio-projects-heading">
          Project workspace
        </h1>
        <p className={styles.description}>
          Cross-client delivery plans, milestones, and retained document counts.
        </p>
        <Link className={styles.actionLink} href="/admin/projects/documents">
          Open document register
        </Link>
      </header>
      <form className={workspace.filterForm} method="get">
        {organisationId && (
          <input name="organisationId" type="hidden" value={organisationId} />
        )}
        <PortalSelect
          defaultValue={rawStatus ?? "all"}
          label="Project status"
          name="status"
        >
          <option value="all">All project states</option>
          {projectStatuses.map((value) => (
            <option key={value} value={value}>
              {projectStatusLabels[value]}
            </option>
          ))}
        </PortalSelect>
        <PortalButton type="submit">Apply filter</PortalButton>
      </form>
      {projects.items.length === 0 ? (
        <p className={styles.rowCopy}>No projects match this workspace view.</p>
      ) : (
        <ul className={styles.rowList}>
          {projects.items.map((project) => (
            <li className={styles.row} key={project.id}>
              <div className={styles.rowContent}>
                <h2 className={styles.rowTitle}>{project.title}</h2>
                <p className={styles.rowCopy}>
                  {project.organisationName} ·{" "}
                  {projectStatusLabels[project.status]} · Target:{" "}
                  {studioDateLabel(project.targetDate)}
                </p>
                <p className={styles.rowCopy}>
                  {project.milestoneCount}{" "}
                  {project.milestoneCount === 1 ? "milestone" : "milestones"} ·{" "}
                  {project.documentCount}{" "}
                  {project.documentCount === 1 ? "document" : "documents"}
                </p>
              </div>
              <Link
                className={styles.actionLink}
                href={`/admin/projects/${project.id}/edit`}
              >
                Edit project
              </Link>
            </li>
          ))}
        </ul>
      )}
      <StudioPagination
        filter={{ organisationId, status }}
        hasNext={projects.hasNext}
        page={projects.page}
        path="/admin/projects"
      />
    </section>
  );
}
