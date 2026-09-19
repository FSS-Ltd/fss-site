import Link from "next/link";
import type { StaffJourneyOverviewRow } from "@/lib/operations/onboarding/queries";
import styles from "../studio-client.module.css";

export function StaffJourneyOverview({
  journeys,
}: {
  journeys: StaffJourneyOverviewRow[];
}): React.JSX.Element {
  const totals = journeys.reduce(
    (result, organisation) => ({
      journeys: result.journeys + organisation.journeyCount,
      active: result.active + organisation.activeCount,
      recovery: result.recovery + organisation.recoveryCount,
    }),
    { journeys: 0, active: 0, recovery: 0 },
  );

  return (
    <section className={styles.page} aria-labelledby="welcome-journeys-heading">
      <header className={styles.hero}>
        <p className={styles.eyebrow}>FSS Studio · Welcome journeys</p>
        <h1 id="welcome-journeys-heading" className={styles.title}>
          A clear start for every client
        </h1>
        <p className={styles.description}>
          Review welcome content, signing readiness, delivery schedules, and
          recovery evidence from one client workspace.
        </p>
      </header>
      <dl className={styles.metricGrid} aria-label="Welcome journey summary">
        <div className={styles.metric}>
          <dt className={styles.metricLabel}>Client workspaces</dt>
          <dd className={styles.metricValue}>{journeys.length}</dd>
        </div>
        <div className={styles.metric}>
          <dt className={styles.metricLabel}>Journeys</dt>
          <dd className={styles.metricValue}>{totals.journeys}</dd>
        </div>
        <div className={styles.metric}>
          <dt className={styles.metricLabel}>Active</dt>
          <dd className={styles.metricValue}>{totals.active}</dd>
        </div>
      </dl>
      {totals.recovery > 0 && (
        <p className={styles.rowCopy} role="status">
          {totals.recovery} journey{totals.recovery === 1 ? " needs" : "s need"}{" "}
          recovery review.
        </p>
      )}
      {journeys.length === 0 ? (
        <section
          className={styles.workspace}
          aria-labelledby="no-journeys-heading"
        >
          <h2 id="no-journeys-heading" className={styles.sectionTitle}>
            No client workspaces yet
          </h2>
          <p className={styles.rowCopy}>
            Client workspaces appear after an organisation has been registered
            for Operations.
          </p>
          <Link className={styles.actionLink} href="/admin/clients">
            Open client register
          </Link>
        </section>
      ) : (
        <ul className={styles.rowList} aria-label="Client welcome workspaces">
          {journeys.map((organisation) => (
            <li className={styles.row} key={organisation.organisationId}>
              <div className={styles.rowContent}>
                <h2 className={styles.rowTitle}>
                  {organisation.organisationName}
                </h2>
                <p className={styles.rowCopy}>
                  {organisation.journeyCount === 0
                    ? "No welcome journey has been prepared."
                    : `${organisation.journeyCount} journey${organisation.journeyCount === 1 ? "" : "s"}, ${organisation.activeCount} active.`}
                </p>
              </div>
              <Link
                className={styles.actionLink}
                href={`/admin/clients/${organisation.organisationId}/journey`}
              >
                Open workspace
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
