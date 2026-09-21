import { Check, FileText } from "lucide-react";
import {
  Notice,
  PageHeader,
  PortalActionLink,
  PortalCard,
  StatusBadge,
  type PortalStatus,
} from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import type { ClientDocument } from "@/lib/operations/documents/types";
import type {
  ClientProjectDetail as ClientProjectDetailData,
  ProjectStatus,
} from "@/lib/operations/projects/types";
import styles from "../client-workspace.module.css";

type ClientProjectDetailProps = Readonly<{
  documents: readonly ClientDocument[];
  organisationId: string;
  project: ClientProjectDetailData;
}>;

function organisationHref(
  pathname: string,
  organisationId: string,
  additionalParameters: Record<string, string> = {},
): string {
  const query = new URLSearchParams({
    organisationId,
    ...additionalParameters,
  });
  return `${portalPath(pathname)}?${query.toString()}`;
}

function formatDate(value: string | null): string {
  if (!value) return "To be confirmed";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function statusPresentation(status: ProjectStatus): {
  label: string;
  tone: PortalStatus;
} {
  const values: Record<ProjectStatus, { label: string; tone: PortalStatus }> = {
    active: { label: "In delivery", tone: "info" },
    completed: { label: "Completed", tone: "success" },
    paused: { label: "Paused", tone: "neutral" },
    planned: { label: "Planned", tone: "neutral" },
    waiting_for_us: { label: "With FSS", tone: "info" },
    waiting_for_you: { label: "Waiting for you", tone: "warning" },
  };
  return values[status];
}

function documentLabel(document: ClientDocument): string {
  if (document.kind === "link") return "Approved link";
  return `${document.filename} · ${Math.max(1, Math.ceil(document.sizeBytes / 1024))} KB`;
}

export function ClientProjectDetail({
  documents,
  organisationId,
  project,
}: ClientProjectDetailProps): React.JSX.Element {
  const status = statusPresentation(project.status);
  return (
    <div className={styles.page}>
      <PageHeader
        breadcrumbs={[
          {
            href: organisationHref("/portal/projects", organisationId),
            label: "Projects",
          },
          { label: project.title },
        ]}
        description={`Your FSS delivery lead is ${project.ownerDisplay || "your FSS team"}.`}
        eyebrow="Your project"
        title={project.title}
        action={
          <PortalActionLink
            href={organisationHref("/portal/requests/new", organisationId, {
              projectId: project.id,
            })}
          >
            New request
          </PortalActionLink>
        }
      />

      <PortalCard title="Agreed outcome" tone="accent">
        <div className={styles.cardHeader}>
          <p className={styles.outcome}>{project.outcome}</p>
          <StatusBadge status={status.tone}>{status.label}</StatusBadge>
        </div>
        <p className={styles.summary}>{project.summary}</p>
        <dl className={styles.metadata}>
          <div>
            <dt>Delivery lead</dt>
            <dd>{project.ownerDisplay || "Your FSS team"}</dd>
          </div>
          <div>
            <dt>Target date</dt>
            <dd>{formatDate(project.targetDate)}</dd>
          </div>
        </dl>
      </PortalCard>

      {project.scheduleDependencies.length > 0 ? (
        <Notice tone="warning">
          <strong>Before we can move ahead</strong>
          <ul className={styles.noticeList}>
            {project.scheduleDependencies.map((dependency) => (
              <li key={dependency}>{dependency}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <section className={styles.group} aria-labelledby="delivery-plan-heading">
        <div className={styles.groupHeading}>
          <div>
            <h2 id="delivery-plan-heading">Delivery plan</h2>
            <p>Visible milestones and the next agreed action.</p>
          </div>
        </div>
        {project.milestones.length > 0 ? (
          <ol className={styles.timeline}>
            {project.milestones.map((milestone, index) => {
              const milestoneStatus = statusPresentation(milestone.status);
              return (
                <li key={milestone.id}>
                  <span className={styles.timelineMarker} aria-hidden="true">
                    {milestone.status === "completed" ? (
                      <Check size={16} />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <PortalCard className={styles.timelineCard}>
                    <div className={styles.cardHeader}>
                      <h3>{milestone.title}</h3>
                      <StatusBadge status={milestoneStatus.tone}>
                        {milestoneStatus.label}
                      </StatusBadge>
                    </div>
                    <p className={styles.summary}>{milestone.summary}</p>
                    <p className={styles.metaText}>
                      {formatDate(milestone.targetDate)} ·{" "}
                      {milestone.ownerDisplay}
                    </p>
                    {milestone.evidence ? (
                      <p className={styles.evidence}>{milestone.evidence}</p>
                    ) : null}
                  </PortalCard>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className={styles.empty}>
            Your milestones will appear here when the delivery schedule is
            agreed.
          </p>
        )}
      </section>

      <section
        className={styles.group}
        aria-labelledby="project-workspace-heading"
      >
        <div className={styles.groupHeading}>
          <div>
            <h2 id="project-workspace-heading">Project workspace</h2>
            <p>Approved records and client actions for this project.</p>
          </div>
        </div>
        <div className={styles.workspaceGrid}>
          <PortalCard title="Agreed scope">
            <ul className={styles.compactList}>
              {project.deliverables.length > 0 ? (
                project.deliverables.map((deliverable) => (
                  <li key={deliverable}>{deliverable}</li>
                ))
              ) : (
                <li>The agreed scope will appear here when it is shared.</li>
              )}
            </ul>
            <PortalActionLink
              href={organisationHref("/portal/agreements", organisationId)}
              variant="secondary"
            >
              Read scope
            </PortalActionLink>
          </PortalCard>
          <PortalCard title="Requests & decisions">
            <p className={styles.summary}>
              Open the shared board to review current work and decisions.
            </p>
            <PortalActionLink
              href={organisationHref("/portal/requests", organisationId)}
              variant="secondary"
            >
              Open board
            </PortalActionLink>
          </PortalCard>
          <PortalCard title="Files & deliverables">
            <p className={styles.summary}>
              {documents.length === 0
                ? "Approved files will appear here when they are ready to share."
                : `${documents.length} approved ${documents.length === 1 ? "item is" : "items are"} available for this project.`}
            </p>
            <PortalActionLink
              href={organisationHref("/portal/documents", organisationId)}
              variant="secondary"
            >
              View files
            </PortalActionLink>
          </PortalCard>
        </div>
      </section>

      {documents.length > 0 ? (
        <section
          className={styles.group}
          aria-labelledby="deliverables-heading"
        >
          <div className={styles.groupHeading}>
            <div>
              <h2 id="deliverables-heading">Approved deliverables</h2>
              <p>Files and links cleared for your project team.</p>
            </div>
          </div>
          <ul className={styles.cardList}>
            {documents.map((document) => (
              <li key={document.id}>
                <PortalCard className={styles.card}>
                  <div className={styles.documentHeading}>
                    <FileText aria-hidden="true" size={22} />
                    <div>
                      <h3>{document.title}</h3>
                      <p>{documentLabel(document)}</p>
                    </div>
                  </div>
                  <PortalActionLink
                    href={organisationHref(
                      `/portal/documents/${document.id}`,
                      organisationId,
                    )}
                    variant="secondary"
                  >
                    View document
                  </PortalActionLink>
                </PortalCard>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
