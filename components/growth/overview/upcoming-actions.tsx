import { Clock3 } from "lucide-react";

import {
  formatGrowthRelativeDay,
  formatGrowthStatusLabel,
} from "@/lib/growth/dashboard/formatters";
import type { UpcomingAction } from "@/lib/growth/dashboard/overview";

import { GrowthNavigationLink } from "../shell/navigation-link";
import styles from "./overview.module.css";

export function UpcomingActions({
  actions,
  now,
}: {
  actions: readonly UpcomingAction[];
  now: string;
}) {
  return (
    <section aria-labelledby="upcoming-actions-heading" className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle} id="upcoming-actions-heading">
          Upcoming actions
        </h2>
      </div>

      {actions.length === 0 ? (
        <p className={styles.queueEmpty}>
          Nothing due. Check back after the next review.
        </p>
      ) : (
        <ol className={styles.actionsList}>
          {actions.map((action) => (
            <li className={styles.actionItem} key={action.prospectId}>
              <span aria-hidden="true" className={styles.actionIcon}>
                <Clock3 size={16} strokeWidth={1.8} />
              </span>
              <div className={styles.actionBody}>
                <p className={styles.actionTitle}>
                  <GrowthNavigationLink
                    href={`/growth/prospects/${action.prospectId}`}
                  >
                    {action.actionLabel} for {action.businessName}
                  </GrowthNavigationLink>
                </p>
                <p className={styles.actionMeta}>
                  {formatGrowthStatusLabel(action.status)}
                </p>
              </div>
              <span className={styles.actionDue}>
                {formatGrowthRelativeDay(action.dueAt, now)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
