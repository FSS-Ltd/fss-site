import {
  formatGrowthPercentage,
} from "@/lib/growth/dashboard/formatters";
import type { SequenceHealth as SequenceHealthData } from "@/lib/growth/dashboard/overview";

import styles from "./overview.module.css";

export function SequenceHealth({ health }: { health: SequenceHealthData }) {
  return (
    <section aria-labelledby="sequence-health-heading" className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle} id="sequence-health-heading">
            Sequence health
          </h2>
          <p className={styles.cardDescription}>How your outreach is performing</p>
        </div>
      </div>

      <div className={styles.healthGrid}>
        <div className={styles.healthTile}>
          <span className={styles.healthLabel}>Delivery rate</span>
          {health.deliveryRate === null ? (
            <span className={styles.healthNote}>No emails sent yet</span>
          ) : (
            <>
              <span className={styles.healthValue}>
                {formatGrowthPercentage(health.deliveryRate)}
              </span>
              <span className={styles.healthNote}>
                {health.sentCount} of {health.sentCount + health.failedCount} sent
              </span>
            </>
          )}
        </div>

        <div className={styles.healthTile}>
          <span className={styles.healthLabel}>Reply rate</span>
          {health.replyRate === null ? (
            <span className={styles.healthNote}>No sequences sent yet</span>
          ) : (
            <>
              <span className={styles.healthValue}>
                {formatGrowthPercentage(health.replyRate)}
              </span>
              <span className={styles.healthNote}>
                {health.repliedEnrollmentCount} of {health.sentEnrollmentCount} replied
              </span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
