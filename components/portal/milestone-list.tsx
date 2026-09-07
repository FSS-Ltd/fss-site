import { Check } from "lucide-react";
import type { ClientMilestone } from "@/lib/operations/projects/types";
import { projectDate, projectStatusLabels } from "./project-summary";
import styles from "./projects.module.css";
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
                  <span className={styles.status}>
                    {projectStatusLabels[milestone.status]}
                  </span>
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
