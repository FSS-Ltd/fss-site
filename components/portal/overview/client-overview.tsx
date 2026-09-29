import Link from "next/link";
import {
  getClientOverviewSteps,
  selectClientAttention,
  type ClientOverview as ClientOverviewData,
} from "@/lib/operations/overview/client-overview";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { getPortalRolePresentation } from "@/lib/operations/auth/permissions";
import type { PortalMembershipSummary } from "@/lib/operations/auth/require-member";
import type { ProjectStatus } from "@/lib/operations/projects/types";
import {
  Notice,
  PageHeader,
  PortalButton,
  StatusBadge,
} from "@/components/portal/ui";
import styles from "./client-overview.module.css";

type ClientOverviewProps = Readonly<{
  canCreateRequest: boolean;
  overview: ClientOverviewData;
  workspaceName: string;
}>;

function organisationHref(pathname: string, organisationId: string): string {
  return `${portalPath(pathname)}?organisationId=${encodeURIComponent(organisationId)}`;
}

function projectStatusTone(
  status: ProjectStatus,
): "neutral" | "info" | "success" | "warning" {
  if (status === "completed") return "success";
  if (status === "waiting_for_you") return "warning";
  if (status === "active") return "info";
  return "neutral";
}

function projectStatusLabel(status: string): string {
  return (
    {
      active: "In delivery",
      completed: "Completed",
      paused: "Paused",
      planned: "Planned",
      waiting_for_us: "With FSS",
      waiting_for_you: "Waiting for you",
    }[status] ?? status
  );
}

function formatTargetDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function ClientOverview({
  canCreateRequest,
  overview,
  workspaceName,
}: ClientOverviewProps): React.JSX.Element {
  const attention = selectClientAttention(overview);
  const steps = getClientOverviewSteps(overview).filter(
    (step) => step.href !== attention?.href,
  );
  const reviewCount = overview.requests?.filter(
    (request) => request.status === "ready_for_review",
  ).length;
  const activeProjectCount = overview.projects?.filter(
    (project) => project.status === "active",
  ).length;
  const nextTargetDate = overview.projects
    ?.map((project) => formatTargetDate(project.targetDate))
    .find((date): date is string => date !== null);
  const latestUpdate = overview.notifications?.[0];

  return (
    <div className={`${styles.page} ${styles.overviewPage}`}>
      <PageHeader
        eyebrow={workspaceName}
        title="Your workspace"
        action={
          canCreateRequest ? (
            <form action={portalPath("/portal/requests/new")} method="get">
              <input
                name="organisationId"
                type="hidden"
                value={overview.organisationId}
              />
              <PortalButton type="submit">New request</PortalButton>
            </form>
          ) : undefined
        }
      />

      <section className={styles.attention} aria-labelledby="attention-heading">
        <p className={styles.sectionLabel}>Your next step</p>
        <h2 id="attention-heading">
          {attention?.title ?? "Your workspace is up to date."}
        </h2>
        <p>
          {attention?.description ??
            "There is no action waiting for you right now."}
        </p>
        {attention ? (
          <Link className={styles.attentionAction} href={attention.href}>
            {attention.actionLabel}
          </Link>
        ) : null}
      </section>

      {reviewCount !== undefined ||
      activeProjectCount !== undefined ||
      nextTargetDate ? (
        <dl className={styles.statGrid}>
          {reviewCount !== undefined ? (
            <div className={styles.statCard}>
              <dt>Ready for review</dt>
              <dd>{reviewCount}</dd>
            </div>
          ) : null}
          {activeProjectCount !== undefined ? (
            <div className={styles.statCard}>
              <dt>In delivery</dt>
              <dd>{activeProjectCount}</dd>
            </div>
          ) : null}
          {nextTargetDate ? (
            <div className={styles.statCard}>
              <dt>Next target date</dt>
              <dd>{nextTargetDate}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {steps.length > 0 ? (
        <section className={styles.panel} aria-labelledby="next-steps-heading">
          <h2 id="next-steps-heading">Your next steps</h2>
          <ul className={styles.stepList}>
            {steps.map((step) => (
              <li key={step.href}>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
                <Link href={step.href}>Open</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {overview.projects !== null ? (
        <section className={styles.panel} aria-labelledby="projects-heading">
          <h2 id="projects-heading">Your projects</h2>
          {overview.projects.length > 0 ? (
            <ul className={styles.projectList}>
              {overview.projects.slice(0, 3).map((project) => (
                <li key={project.id}>
                  <div>
                    <h3>{project.title}</h3>
                    <p>{project.summary}</p>
                  </div>
                  <div className={styles.projectMeta}>
                    <StatusBadge status={projectStatusTone(project.status)}>
                      {projectStatusLabel(project.status)}
                    </StatusBadge>
                    <Link
                      href={organisationHref(
                        `/portal/projects/${project.id}`,
                        overview.organisationId,
                      )}
                    >
                      View project
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>
              Your projects will appear here when they are ready to share.
            </p>
          )}
        </section>
      ) : null}

      {latestUpdate ? (
        <section
          className={styles.panel}
          aria-labelledby="latest-update-heading"
        >
          <h2 id="latest-update-heading">Latest update</h2>
          <p className={styles.updateTitle}>{latestUpdate.title}</p>
          <p>{latestUpdate.body}</p>
          <Link
            className={styles.textLink}
            href={organisationHref(
              `/portal/requests/${latestUpdate.requestId}`,
              overview.organisationId,
            )}
          >
            Read update
          </Link>
        </section>
      ) : null}
    </div>
  );
}

export function ClientWorkspaceChooser({
  memberships,
}: Readonly<{
  memberships: readonly PortalMembershipSummary[];
}>): React.JSX.Element {
  return (
    <div className={styles.page}>
      <PageHeader
        description="Choose the organisation you want to work in. Your access stays separate for each workspace."
        eyebrow="Your FSS workspace"
        title="Choose your workspace"
      />
      <Notice tone="info">
        Select an organisation to see its project updates, requests and next
        steps.
      </Notice>
      <ul className={styles.workspaceList}>
        {memberships.map((membership) => (
          <li key={membership.organisationId}>
            <Link href={organisationHref("/portal", membership.organisationId)}>
              <span>
                <strong>{membership.displayName}</strong>
                <small>
                  {getPortalRolePresentation(membership.role).label}
                </small>
              </span>
              <span aria-hidden="true">Open</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
