import Link from "next/link";
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
}: {
  state: ClientListState;
  billingEnabled?: boolean;
}): React.JSX.Element {
  return (
    <section className={styles.page} aria-labelledby="clients-heading">
      <header>
        <p className={styles.eyebrow}>Operations</p>
        <h1 id="clients-heading" className={styles.heading}>
          Client register
        </h1>
        <p className={styles.subtitle}>
          Organisations and their reviewed engagement links.
        </p>
        <Link href="/growth/operations/portal-access">Portal access</Link>
        {billingEnabled && (
          <Link href="/growth/operations/billing">
            Review billing exceptions
          </Link>
        )}
      </header>
      {state.status === "error" ? (
        <div className={styles.notice} role="alert">
          <p>{state.message}</p>
          <Link href="/growth/operations/clients">Reload client register</Link>
        </div>
      ) : state.data.rows.length === 0 ? (
        <div className={styles.notice}>
          <h2>No organisations on this page</h2>
          <p>
            Organisations appear here after their engagement mappings have been
            reviewed.
          </p>
          <Link href="/growth/operations/clients">View first page</Link>
        </div>
      ) : (
        <>
          <ClientPortfolioSummary data={state.data} />
          <ul className={styles.list}>
            {state.data.rows.map((organisation) => (
              <li className={styles.row} key={organisation.id}>
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
                    <dd>{organisation.tradingStatus}</dd>
                  </div>
                  <div>
                    <dt>Register status</dt>
                    <dd>{organisation.lifecycle}</dd>
                  </div>
                  <div>
                    <dt>Timezone</dt>
                    <dd>{organisation.timezone}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          {state.data.nextCursor && (
            <nav aria-label="Client register pages">
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
