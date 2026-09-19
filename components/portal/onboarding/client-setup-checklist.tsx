import { Check } from "lucide-react";
import type { ClientSetupChecklist } from "@/lib/operations/onboarding/client-checklist";
import styles from "../projects.module.css";

type ClientSetupChecklistProps = {
  checklist: ClientSetupChecklist;
  enabled: boolean;
};

const checklistItems = [
  {
    key: "agreementSigned",
    title: "Agreement signed",
    complete: "Your signed agreement is retained in your workspace.",
    pending: "Review and sign the approved agreement when it is ready.",
  },
  {
    key: "billingReady",
    title: "First invoice ready",
    complete: "Your first agreed invoice has been issued.",
    pending:
      "Your first invoice will appear after all required signatures and the scheduled activation time.",
  },
  {
    key: "filesReady",
    title: "Files available",
    complete: "Cleared files are available in your client workspace.",
    pending:
      "Files will appear here after they have been safely checked and shared with your workspace.",
  },
  {
    key: "serviceReady",
    title: "Service ready",
    complete: "FSS has recorded that your service is ready to begin.",
    pending:
      "FSS will confirm readiness after the agreed prerequisites are recorded.",
  },
] as const satisfies ReadonlyArray<{
  key: keyof ClientSetupChecklist;
  title: string;
  complete: string;
  pending: string;
}>;

export function ClientSetupChecklist({
  checklist,
  enabled,
}: ClientSetupChecklistProps): React.JSX.Element {
  if (!enabled) {
    return (
      <section
        className={styles.notice}
        aria-labelledby="checklist-unavailable-heading"
      >
        <h2 id="checklist-unavailable-heading">
          Getting started is unavailable
        </h2>
        <p>
          FSS has not enabled onboarding delivery for this workspace. Existing
          agreements and billing records remain available in their usual places.
        </p>
      </section>
    );
  }

  return (
    <ol className={styles.timeline} aria-label="Client setup checklist">
      {checklistItems.map((item, index) => {
        const complete = checklist[item.key];
        return (
          <li key={item.key}>
            <span
              className={`${styles.step} ${complete ? styles.complete : ""}`}
              aria-label={complete ? "Complete" : "Not complete"}
            >
              {complete ? <Check size={16} aria-hidden="true" /> : index + 1}
            </span>
            <div className={styles.milestoneBody}>
              <h2>{item.title}</h2>
              <p className={styles.copy}>
                {complete ? item.complete : item.pending}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
