import styles from "./route-state.module.css";

export default function GrowthDashboardLoading() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading dashboard"
      className={styles.state}
    >
      <div className={styles.headingSkeleton} />
      <div className={styles.metrics}>
        <div className={styles.metricSkeleton} />
        <div className={styles.metricSkeleton} />
        <div className={styles.metricSkeleton} />
      </div>
      <div className={styles.panelSkeleton} />
    </section>
  );
}
