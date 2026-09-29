"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import {
  Notice,
  PageHeader,
  PortalActionLink,
  PortalCard,
  StatusBadge,
  type PortalStatus,
} from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import type {
  ClientProject,
  ProjectStatus,
} from "@/lib/operations/projects/types";
import styles from "../client-workspace.module.css";

type ClientProjectListProps = Readonly<{
  organisationId: string;
  projects: readonly ClientProject[];
}>;

function organisationHref(pathname: string, organisationId: string): string {
  const query = new URLSearchParams({ organisationId });
  return `${portalPath(pathname)}?${query.toString()}`;
}

function projectStatus(status: ProjectStatus): {
  label: string;
  tone: PortalStatus;
} {
  const presentation: Record<
    ProjectStatus,
    { label: string; tone: PortalStatus }
  > = {
    active: { label: "In delivery", tone: "info" },
    completed: { label: "Completed", tone: "success" },
    paused: { label: "Paused", tone: "neutral" },
    planned: { label: "Planned", tone: "neutral" },
    waiting_for_us: { label: "With FSS", tone: "info" },
    waiting_for_you: { label: "Waiting for you", tone: "warning" },
  };

  return presentation[status];
}

function targetDate(value: string | null): string {
  if (!value) return "Target date to be confirmed";

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function ProjectCards({
  projects,
  organisationId,
}: Readonly<{
  organisationId: string;
  projects: readonly ClientProject[];
}>): React.JSX.Element {
  return (
    <ul className={styles.cardList}>
      {projects.map((project) => {
        const status = projectStatus(project.status);
        return (
          <li key={project.id}>
            <PortalCard className={styles.card}>
              <div className={styles.cardHeader}>
                <h3>{project.title}</h3>
                <StatusBadge status={status.tone}>{status.label}</StatusBadge>
              </div>
              <p className={styles.summary}>{project.summary}</p>
              <dl className={styles.metadata}>
                <div>
                  <dt>Delivery lead</dt>
                  <dd>{project.ownerDisplay || "Your FSS team"}</dd>
                </div>
                <div>
                  <dt>Target</dt>
                  <dd>{targetDate(project.targetDate)}</dd>
                </div>
              </dl>
              <PortalActionLink
                href={organisationHref(
                  `/portal/projects/${project.id}`,
                  organisationId,
                )}
                variant="secondary"
              >
                View project
                <ArrowUpRight aria-hidden="true" size={16} />
              </PortalActionLink>
            </PortalCard>
          </li>
        );
      })}
    </ul>
  );
}

function ProjectGroup({
  empty,
  organisationId,
  projects,
  title,
}: Readonly<{
  empty: string;
  organisationId: string;
  projects: readonly ClientProject[];
  title: string;
}>): React.JSX.Element {
  const headingId = `${title.toLowerCase().replaceAll(" ", "-")}-heading`;
  return (
    <section className={styles.group} aria-labelledby={headingId}>
      <div className={styles.groupHeading}>
        <div>
          <h2 id={headingId}>{title}</h2>
        </div>
        <span aria-label={`${projects.length} projects`}>
          {projects.length}
        </span>
      </div>
      {projects.length > 0 ? (
        <ProjectCards organisationId={organisationId} projects={projects} />
      ) : (
        <p className={styles.empty}>{empty}</p>
      )}
    </section>
  );
}

export function ClientProjectList({
  organisationId,
  projects,
}: ClientProjectListProps): React.JSX.Element {
  const [activeView, setActiveView] = useState<
    "all" | "active" | "awaiting" | "completed"
  >("all");
  const awaitingYou = projects.filter(
    (project) => project.status === "waiting_for_you",
  );
  const current = projects.filter(
    (project) =>
      project.status !== "completed" && project.status !== "waiting_for_you",
  );
  const completed = projects.filter(
    (project) => project.status === "completed",
  );
  const views = [
    { id: "all", label: "All", count: projects.length },
    { id: "active", label: "Active", count: current.length },
    { id: "awaiting", label: "Awaiting you", count: awaitingYou.length },
    { id: "completed", label: "Completed", count: completed.length },
  ] as const;

  return (
    <div className={styles.page}>
      <PageHeader
        breadcrumbs={[{ href: portalPath("/portal"), label: "Your workspace" }]}
        description="The work we have agreed, its current shape, and what happens next."
        eyebrow="Your work with FSS"
        title="Your projects"
        action={
          projects.length > 0 ? (
            <PortalActionLink
              href={organisationHref("/portal/requests/new", organisationId)}
            >
              New request
            </PortalActionLink>
          ) : undefined
        }
      />
      <div
        className={styles.projectTabs}
        role="group"
        aria-label="Filter projects by status"
      >
        {views.map((view) => (
          <button
            aria-pressed={activeView === view.id}
            className={styles.projectTab}
            id={`projects-tab-${view.id}`}
            key={view.id}
            onClick={() => setActiveView(view.id)}
            type="button"
          >
            {view.label} <span>{view.count}</span>
          </button>
        ))}
      </div>
      {projects.length === 0 ? (
        <Notice tone="info">
          No projects are shared with your workspace yet. FSS will add your
          agreed work and schedule here once setup is complete.
        </Notice>
      ) : (
        <>
          {activeView === "all" || activeView === "active" ? (
            <ProjectGroup
              empty="Your active projects will appear here once they are agreed."
              organisationId={organisationId}
              projects={current}
              title="Active work"
            />
          ) : null}
          {activeView === "all" || activeView === "awaiting" ? (
            <ProjectGroup
              empty="There is nothing waiting for your team right now."
              organisationId={organisationId}
              projects={awaitingYou}
              title="Awaiting your response"
            />
          ) : null}
          {activeView === "all" || activeView === "completed" ? (
            <ProjectGroup
              empty="Completed projects will appear here after handover."
              organisationId={organisationId}
              projects={completed}
              title="Completed work"
            />
          ) : null}
        </>
      )}
    </div>
  );
}
