import type {
  ClientProject,
  ProjectStatus,
} from "@/lib/operations/projects/types";
import styles from "./projects.module.css";

export const projectStatusLabels: Record<ProjectStatus, string> = {
  planned: "Planned",
  active: "In progress",
  waiting_for_us: "With FSS",
  waiting_for_you: "Waiting on you",
  completed: "Completed",
  paused: "Paused",
};
export function projectDate(value: string | null): string {
  if (!value) return "To be confirmed";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}
export function ProjectSummary({
  project,
}: {
  project: ClientProject;
}): React.JSX.Element {
  return (
    <section aria-labelledby="project-overview" className={styles.overview}>
      <div className={styles.sectionHeading}>
        <h2 id="project-overview">The outcome</h2>
        <span className={styles.status}>
          {projectStatusLabels[project.status]}
        </span>
      </div>
      <p className={styles.outcome}>{project.outcome}</p>
      <p className={styles.copy}>{project.summary}</p>
      <dl className={styles.facts}>
        <div>
          <dt>Your delivery contact</dt>
          <dd>{project.ownerDisplay || "Your FSS team"}</dd>
        </div>
        <div>
          <dt>Target date</dt>
          <dd>{projectDate(project.targetDate)}</dd>
        </div>
      </dl>
      {project.deliverables.length > 0 && (
        <div className={styles.deliverables}>
          <h3>What we’re delivering</h3>
          <ul>
            {project.deliverables.map((item, index) => (
              <li key={`${index}-${item}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {project.scheduleDependencies.length > 0 && (
        <aside className={styles.notice}>
          <h3>Before we can move ahead</h3>
          <ul>
            {project.scheduleDependencies.map((item, index) => (
              <li key={`${index}-${item}`}>{item}</li>
            ))}
          </ul>
        </aside>
      )}
      {!project.targetDate && (
        <p className={styles.note}>
          Your project schedule will appear here once it is confirmed.
        </p>
      )}
      {project.scheduleEvidence && (
        <p className={styles.note}>{project.scheduleEvidence}</p>
      )}
    </section>
  );
}
