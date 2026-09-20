import { PortalCard } from "@/components/portal/ui";
import type { ClientRequestDetail } from "@/lib/operations/requests/types";
import { requestDate } from "./presentation";
import styles from "./requests.module.css";

export function RequestAllowance({
  allowance,
}: Pick<ClientRequestDetail, "allowance">): React.JSX.Element | null {
  if (!allowance) return null;
  return (
    <PortalCard
      className={styles.section}
      headingId="request-allowance-heading"
      title="Approved allowance"
    >
      <p className={styles.nextAction}>
        {allowance.total} {allowance.unit}
      </p>
      <p className={styles.note}>Recorded in the agreed contractual unit.</p>
      <ol className={styles.history}>
        {allowance.adjustments.map((adjustment) => (
          <li key={adjustment.id}>
            <div className={styles.row}>
              <span>
                {adjustment.amount} {allowance.unit}
              </span>
              <time className={styles.note} dateTime={adjustment.createdAt}>
                {requestDate(adjustment.createdAt)}
              </time>
            </div>
            <p className={styles.prose}>{adjustment.reason}</p>
            <p className={styles.note}>
              Approval: {adjustment.approvalReference}
            </p>
          </li>
        ))}
      </ol>
    </PortalCard>
  );
}
