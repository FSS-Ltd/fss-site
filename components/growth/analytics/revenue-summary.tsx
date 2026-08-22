import { formatGrowthCurrency } from "@/lib/growth/dashboard/formatters";
import type { AnalyticsValues } from "@/lib/growth/dashboard/analytics";

import styles from "./analytics.module.css";

export function RevenueSummary({ values }: { values: AnalyticsValues }) {
  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>Pipeline and delivery value</h2>
      <p className={styles.sectionNote}>
        Figures are the agreed commercial value the founder closed on, not recognised
        accounting revenue.
      </p>

      <div className={styles.statRow}>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Open pipeline</p>
          <p className={styles.statValue}>
            {formatGrowthCurrency(values.openPipelineValuePence)}
          </p>
          <p className={styles.statMeta}>Forecast as of today, not this month</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Agreed won value</p>
          <p className={styles.statValue}>
            {formatGrowthCurrency(values.agreedWonValuePence)}
          </p>
          <p className={styles.statMeta}>Won this month</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Completed delivery</p>
          <p className={styles.statValue}>
            {formatGrowthCurrency(values.completedDeliveryValuePence)}
          </p>
          <p className={styles.statMeta}>Reached complete this month</p>
        </div>
      </div>
    </div>
  );
}
