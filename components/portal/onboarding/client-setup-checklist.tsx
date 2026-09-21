import { CheckCircle2, Circle } from "lucide-react";
import { Notice, StatusBadge } from "@/components/portal/ui";
import type { ClientSetupChecklist } from "@/lib/operations/onboarding/client-checklist";
import styles from "./client-onboarding.module.css";

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
      <Notice tone="info">
        <strong>Getting started is unavailable.</strong>
        <p>
          FSS has not enabled onboarding delivery for this workspace. Existing
          agreements and billing records remain available in their usual places.
        </p>
      </Notice>
    );
  }

  return (
    <ol className={styles.milestoneList} aria-label="Client setup checklist">
      {checklistItems.map((item) => {
        const complete = checklist[item.key];
        return (
          <li className={styles.milestoneRow} key={item.key}>
            <span className={styles.milestoneLabel}>
              {complete ? (
                <CheckCircle2 aria-hidden="true" size={18} />
              ) : (
                <Circle aria-hidden="true" size={18} />
              )}
              {item.title}
            </span>
            <div>
              <StatusBadge status={complete ? "success" : "neutral"}>
                {complete ? "Complete" : "Waiting"}
              </StatusBadge>
              <p className={styles.taskCopy}>
                {complete ? item.complete : item.pending}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
