import Link from "next/link";
import { OperationsPageHeader } from "@/components/operations/shared/operations-page-header";
import sharedStyles from "@/components/operations/shared/operations-ui.module.css";
import type { OrganisationPage } from "@/lib/operations/organisations/types";
import {
  DashboardMetric,
  DistributionBars,
} from "../dashboard/dashboard-visuals";
import styles from "./client-list.module.css";

export type ClientListState =
  | { status: "ready"; data: OrganisationPage }
  | { status: "error"; message: string };

function ClientPortfolioSummary({
  data,
}: {
  data: OrganisationPage;
}): React.JSX.Element | null {
  if (data.rows.length === 0) return null;

  const active = data.rows.filter(
    (organisation) => organisation.tradingStatus === "active",
  ).length;
  const inactive = data.rows.filter(
    (organisation) => organisation.tradingStatus === "inactive",
  ).length;
  const unverified = data.rows.filter(
    (organisation) => organisation.tradingStatus === "unknown",
  ).length;
  const current = data.rows.filter(
    (organisation) => organisation.lifecycle === "active",
  ).length;
  const engagementLinks = data.rows.reduce(
    (sum, organisation) => sum + organisation.engagementCount,
    0,
  );

  return (
    <section className={styles.portfolio} aria-labelledby="portfolio-heading">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Portfolio view</p>
          <h2 id="portfolio-heading">Client register coverage</h2>
          <p>
            The summary covers this page of the client register. Use it to spot
            unverified trading status before opening an engagement.
          </p>
        </div>
      </div>
      <div className={styles.metrics}>
        <DashboardMetric
          label="Organisations shown"
          supportingText="Rows in the current client register page."
          value={data.rows.length.toLocaleString("en-GB")}
        />
        <DashboardMetric
          label="Current client records"
          signal={{
            label:
              current === data.rows.length
                ? "All shown records are current"
                : `${data.rows.length - current} archived record${data.rows.length - current === 1 ? "" : "s"} shown`,
            tone: current === data.rows.length ? "positive" : "neutral",
          }}
          supportingText="Records still active in the Operations client register."
          value={current.toLocaleString("en-GB")}
        />
        <DashboardMetric
          label="Engagement links"
          signal={{ label: "Reviewed mappings only", tone: "brand" }}
          supportingText="Linked engagements available for agreement work."
          value={engagementLinks.toLocaleString("en-GB")}
        />
        <DashboardMetric
          label="Trading status to review"
          signal={
            unverified > 0
              ? {
                  label: "Verify before relying on the record",
                  tone: "warning",
                }
              : {
                  label: "All shown trading states are recorded",
                  tone: "positive",
                }
          }
          supportingText="Organisations whose trading status is not yet verified."
          value={unverified.toLocaleString("en-GB")}
        />
      </div>
      <DistributionBars
        description="Trading status is displayed with text and colour so the data-quality issue remains clear in every viewing context."
        items={[
          { label: "Trading active", tone: "positive", value: active },
          { label: "Trading inactive", tone: "neutral", value: inactive },
          { label: "Status to verify", tone: "warning", value: unverified },
        ]}
        title="Trading status distribution"
      />
    </section>
  );
}

export function ClientList({
  state,
  billingEnabled = false,
  routePrefix = "/growth/operations/clients",
  showPortalAccess = true,
  workspaceContext = "Growth · Operations",
}: {
  state: ClientListState;
  billingEnabled?: boolean;
  routePrefix?: string;
  showPortalAccess?: boolean;
  workspaceContext?: string;
}): React.JSX.Element {
  const hasServerPagination =
    state.status === "ready" &&
    state.data.page !== undefined &&
    state.data.hasNext !== undefined;
  const currentPage =
    state.status === "ready" && state.data.page !== undefined
      ? state.data.page
      : 1;
  const pageHref = (page: number) => `${routePrefix}?page=${page}`;

  return (
    <section className={`${sharedStyles.page} ${styles.page}`}>
      <OperationsPageHeader
        context={workspaceContext}
        title="Client register"
        description="Organisations and their reviewed engagement links."
        variant="inverse"
        action={
          <nav className={styles.headerActions} aria-label="Client operations">
            {showPortalAccess && (
              <Link href="/growth/operations">Portal access</Link>
            )}
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
          <Link href={routePrefix}>Reload client register</Link>
        </div>
      ) : (
        <>
          <ClientPortfolioSummary data={state.data} />
          {state.data.rows.length === 0 ? (
            <div className={`${sharedStyles.emptyState} ${styles.notice}`}>
              <h2>No organisations on this page</h2>
              <p>
                Organisations appear here after their engagement mappings have
                been reviewed.
              </p>
              <Link href={routePrefix}>View first page</Link>
            </div>
          ) : (
            <ul className={styles.list}>
              {state.data.rows.map((organisation) => (
                <li
                  className={`${sharedStyles.panel} ${styles.row}`}
                  key={organisation.id}
                >
                  <div>
                    <h2 className={styles.name}>
                      <Link href={`${routePrefix}/${organisation.id}`}>
                        {organisation.displayName}
                      </Link>
                    </h2>
                    <p className={styles.detail}>{organisation.legalName}</p>
                    <Link
                      className={styles.rowAction}
                      href={`${routePrefix}/${organisation.id}/requests`}
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
          {hasServerPagination && (currentPage > 1 || state.data.hasNext) && (
            <nav
              className={styles.pagination}
              aria-label="Client register pages"
            >
              {currentPage > 1 ? (
                <Link href={pageHref(currentPage - 1)}>Previous page</Link>
              ) : (
                <span />
              )}
              {state.data.hasNext ? (
                <Link href={pageHref(currentPage + 1)}>Next page</Link>
              ) : (
                <span />
              )}
            </nav>
          )}
          {!hasServerPagination && state.data.nextCursor && (
            <nav
              className={styles.pagination}
              aria-label="Client register pages"
            >
              <Link
                href={`${routePrefix}?after=${encodeURIComponent(state.data.nextCursor)}`}
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
