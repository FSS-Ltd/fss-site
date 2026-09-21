import { Check } from "lucide-react";
import { StatusBadge, type PortalStatus } from "@/components/portal/ui";
import type { ClientMilestone } from "@/lib/operations/projects/types";
import { projectDate, projectStatusLabels } from "./project-summary";
import styles from "./projects.module.css";

function projectStatusTone(status: ClientMilestone["status"]): PortalStatus {
  if (status === "completed") return "success";
  if (status === "waiting_for_you") return "warning";
  if (status === "active" || status === "waiting_for_us") return "info";
  return "neutral";
}

export function MilestoneList({
  milestones,
}: {
  milestones: ClientMilestone[];
}): React.JSX.Element {
  return (
    <section aria-labelledby="milestones-heading" className={styles.section}>
      <div className={styles.sectionHeading}>
        <h2 id="milestones-heading">Milestones</h2>
        <span className={styles.note}>Your delivery, step by step</span>
      </div>
      {milestones.length === 0 ? (
        <p className={styles.empty}>
          Your workspace is ready. Your milestones will appear here when your
          schedule is agreed.
        </p>
      ) : (
        <ol className={styles.timeline}>
          {milestones.map((milestone, index) => (
            <li key={milestone.id}>
              <span
                className={`${styles.step} ${milestone.status === "completed" ? styles.complete : ""}`}
                aria-hidden="true"
              >
                {milestone.status === "completed" ? (
                  <Check size={16} />
                ) : (
                  index + 1
                )}
              </span>
              <div className={styles.milestoneBody}>
                <div className={styles.sectionHeading}>
                  <h3>{milestone.title}</h3>
                  <StatusBadge status={projectStatusTone(milestone.status)}>
                    {projectStatusLabels[milestone.status]}
                  </StatusBadge>
                </div>
                <p className={styles.copy}>{milestone.summary}</p>
                <p className={styles.note}>
                  {projectDate(milestone.targetDate)}
                  {milestone.ownerDisplay ? ` · ${milestone.ownerDisplay}` : ""}
                </p>
                {milestone.evidence && (
                  <p className={styles.evidence}>{milestone.evidence}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
