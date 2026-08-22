import { formatGrowthDateTime, formatGrowthStatusLabel } from "@/lib/growth/dashboard/formatters";
import type { CommercialHistoryEntry } from "@/lib/growth/dashboard/deals";

import styles from "./deals.module.css";

export function CommercialHistory({
  history,
}: {
  history: readonly CommercialHistoryEntry[];
}) {
  if (history.length === 0) {
    return <p className={styles.inlineEmpty}>No commercial decisions recorded yet.</p>;
  }

  return (
    <ol className={styles.historyList}>
      {history.map((entry) => (
        <li className={styles.historyItem} key={entry.id}>
          <p className={styles.historyTransition}>
            {formatGrowthStatusLabel(entry.fromState)} &rarr;{" "}
            {formatGrowthStatusLabel(entry.toState)}
          </p>
          <p className={styles.historyMeta}>{formatGrowthDateTime(entry.occurredAt)}</p>
          {entry.reasonCode && (
            <p className={styles.historyReason}>{entry.reasonCode}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
