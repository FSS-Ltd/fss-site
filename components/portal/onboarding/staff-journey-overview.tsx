import { Building2, TriangleAlert } from "lucide-react";
import {
  Notice,
  PageHeader,
  PortalActionLink,
  PortalCard,
  StatusBadge,
} from "@/components/portal/ui";
import type { StaffJourneyOverviewRow } from "@/lib/operations/onboarding/queries";
import { portalPath } from "@/lib/operations/auth/portal-url";
import styles from "./staff-journey-overview.module.css";

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
    <section className={styles.page} aria-label="Welcome journeys">
      <PageHeader
        description="Review welcome content, signing readiness, delivery schedules, and recovery evidence from one client workspace."
        eyebrow="FSS Studio · Welcome journeys"
        title="A clear start for every client"
        action={
          <PortalActionLink
            href={portalPath("/portal/admin/welcome/templates")}
            variant="secondary"
          >
            Manage welcome templates
          </PortalActionLink>
        }
      />
      <section
        className={styles.summary}
        aria-labelledby="journey-summary-title"
      >
        <h2 id="journey-summary-title">Draft journeys</h2>
        <dl className={styles.metrics}>
          <div>
            <dt>Client workspaces</dt>
            <dd>{journeys.length}</dd>
          </div>
          <div>
            <dt>Journeys</dt>
            <dd>{totals.journeys}</dd>
          </div>
          <div>
            <dt>Active</dt>
            <dd>{totals.active}</dd>
          </div>
        </dl>
      </section>
      {totals.recovery > 0 ? (
        <Notice tone="warning">
          <TriangleAlert aria-hidden="true" size={18} />
          <strong>Needs attention.</strong> {totals.recovery} journey
          {totals.recovery === 1 ? " needs" : "s need"} recovery review.
        </Notice>
      ) : null}
      {journeys.length === 0 ? (
        <PortalCard
          description="Client workspaces appear after an organisation has been registered for Operations."
          title="No client workspaces yet"
        >
          <PortalActionLink href={portalPath("/portal/admin/clients")}>
            Open client register
          </PortalActionLink>
        </PortalCard>
      ) : (
        <ul
          className={styles.workspaces}
          aria-label="Client welcome workspaces"
        >
          {journeys.map((organisation) => (
            <li key={organisation.organisationId}>
              <PortalCard className={styles.workspaceCard}>
                <span className={styles.workspaceIcon}>
                  <Building2 aria-hidden="true" size={20} />
                </span>
                <div className={styles.workspaceDetails}>
                  <h2>{organisation.organisationName}</h2>
                  <p>
                    {organisation.journeyCount === 0
                      ? "No welcome journey has been prepared."
                      : `${organisation.journeyCount} journey${organisation.journeyCount === 1 ? "" : "s"}, ${organisation.activeCount} active.`}
                  </p>
                </div>
                <StatusBadge
                  status={organisation.recoveryCount ? "warning" : "info"}
                >
                  {organisation.recoveryCount
                    ? `${organisation.recoveryCount} needs attention`
                    : "Monitoring"}
                </StatusBadge>
                <PortalActionLink
                  href={portalPath(
                    `/portal/admin/clients/${organisation.organisationId}/journey`,
                  )}
                  variant="secondary"
                >
                  Open workspace
                </PortalActionLink>
              </PortalCard>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
