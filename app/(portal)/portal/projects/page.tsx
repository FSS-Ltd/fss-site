import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { listPortalProjects } from "@/lib/operations/projects/repository";
import type { ClientProject } from "@/lib/operations/projects/types";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import {
  projectDate,
  projectStatusLabels,
} from "@/components/portal/project-summary";
import styles from "@/components/portal/projects.module.css";
import { getProjectPageContext } from "./_context";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const context = await getProjectPageContext(
    (await searchParams).organisationId,
  );
  if (!context) return <PortalUnavailable />;
  let projects: ClientProject[];
  try {
    projects = await listPortalProjects(
      getPortalDb(),
      context.identity,
      context.organisationId,
      randomUUID(),
    );
  } catch (error) {
    if (error instanceof PortalAccessDenied) notFound();
    return <PortalUnavailable />;
  }
  return (
    <div className={styles.page}>
      <Link className={styles.breadcrumb} href="/portal">
        <ArrowLeft size={16} aria-hidden="true" />
        Your workspace
      </Link>
      <p className={styles.eyebrow}>Your work with FSS</p>
      <h1 className={styles.title}>Projects</h1>
      <p className={styles.copy}>
        The work we’ve agreed. The next steps ahead.
      </p>
      {projects.length === 0 ? (
        <p className={styles.empty}>
          Your workspace is ready. Your projects and schedule will appear here
          once they are agreed.
        </p>
      ) : (
        <ul className={styles.projectList}>
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                className={styles.projectLink}
                href={`/portal/projects/${project.id}?organisationId=${context.organisationId}`}
              >
                <div className={styles.sectionHeading}>
                  <h2>{project.title}</h2>
                  <ArrowUpRight size={19} aria-hidden="true" />
                </div>
                <p className={styles.copy}>{project.summary}</p>
                <div className={styles.sectionHeading}>
                  <span className={styles.status}>
                    {projectStatusLabels[project.status]}
                  </span>
                  <span className={styles.note}>
                    Target: {projectDate(project.targetDate)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
