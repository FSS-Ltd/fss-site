import Link from "next/link";
import { OperationsPageHeader } from "@/components/operations/shared/operations-page-header";
import sharedStyles from "@/components/operations/shared/operations-ui.module.css";
import type { OrganisationPage } from "@/lib/operations/organisations/types";
import styles from "./client-list.module.css";

export type ClientListState =
  | { status: "ready"; data: OrganisationPage }
  | { status: "error"; message: string };

export function ClientList({
  state,
  billingEnabled = false,
}: {
  state: ClientListState;
  billingEnabled?: boolean;
}): React.JSX.Element {
  const rows = state.status === "ready" ? state.data.rows : [];
  const engagementCount = rows.reduce(
    (total, organisation) => total + organisation.engagementCount,
    0,
  );

  return (
    <section className={`${sharedStyles.page} ${styles.page}`}>
      <OperationsPageHeader
        context="Growth · Operations"
        title="Client register"
        description="Organisations and their reviewed engagement links."
        action={
          <nav className={styles.headerActions} aria-label="Client operations">
            <Link href="/growth/operations/portal-access">Portal access</Link>
            {billingEnabled && (
              <Link href="/growth/operations/billing">
                Review billing exceptions
              </Link>
            )}
          </nav>
        }
      />
      {state.status === "error" ? (
        <div
          className={`${sharedStyles.errorState} ${styles.notice}`}
          role="alert"
        >
          <p>{state.message}</p>
          <Link href="/growth/operations/clients">Reload client register</Link>
        </div>
      ) : (
        <>
          <section
            className={sharedStyles.metricGrid}
            aria-label="Client register summary"
          >
            <article className={sharedStyles.metricCard}>
              <h2 className={styles.metricLabel}>Client organisations</h2>
              <p className={styles.metricValue}>
                {rows.length} client organisation
                {rows.length === 1 ? "" : "s"} on this page
              </p>
            </article>
            <article className={sharedStyles.metricCard}>
              <h2 className={styles.metricLabel}>Reviewed engagements</h2>
              <p className={styles.metricValue}>
                {engagementCount} reviewed engagement link
                {engagementCount === 1 ? "" : "s"}
              </p>
            </article>
          </section>
          {rows.length === 0 ? (
            <div className={`${sharedStyles.emptyState} ${styles.notice}`}>
              <h2>No organisations on this page</h2>
              <p>
                Organisations appear here after their engagement mappings have
                been reviewed.
              </p>
              <Link href="/growth/operations/clients">View first page</Link>
            </div>
          ) : (
            <ul className={styles.list}>
              {rows.map((organisation) => (
                <li
                  className={`${sharedStyles.panel} ${styles.row}`}
                  key={organisation.id}
                >
                  <div>
                    <h2 className={styles.name}>
                      <Link
                        href={`/growth/operations/clients/${organisation.id}/agreements`}
                      >
                        {organisation.displayName}
                      </Link>
                    </h2>
                    <p className={styles.detail}>{organisation.legalName}</p>
                    <Link
                      className={styles.rowAction}
                      href={`/growth/operations/clients/${organisation.id}/requests`}
                    >
                      Requests
                    </Link>
                  </div>
                  <dl className={styles.facts}>
                    <div>
                      <dt>Engagements</dt>
                      <dd>{organisation.engagementCount}</dd>
                    </div>
                    <div>
                      <dt>Trading status</dt>
                      <dd>
                        <span
                          className={sharedStyles.statusChip}
                          data-status={organisation.tradingStatus}
                        >
                          {organisation.tradingStatus}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Register status</dt>
                      <dd>
                        <span
                          className={sharedStyles.statusChip}
                          data-status={organisation.lifecycle}
                        >
                          {organisation.lifecycle}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Timezone</dt>
                      <dd>{organisation.timezone}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
          {state.data.nextCursor && (
            <nav
              className={styles.pagination}
              aria-label="Client register pages"
            >
              <Link
                href={`/growth/operations/clients?after=${encodeURIComponent(state.data.nextCursor)}`}
              >
                Next page
              </Link>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
