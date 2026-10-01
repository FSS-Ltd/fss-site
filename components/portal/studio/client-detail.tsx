import {
  PageHeader,
  PortalActionLink,
  PortalCard,
  StatusBadge,
} from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import type { StudioClientDetail as StudioClientDetailData } from "@/lib/operations/studio/clients";
import { StudioClientCurrencyForm } from "./client-currency-form";
import styles from "./client-detail.module.css";

type StudioClientDetailProps = Readonly<{
  client: StudioClientDetailData;
}>;

function adminHref(pathname: string, organisationId: string): string {
  const path = portalPath(pathname);
  const url = new URL(path, "https://portal.internal");
  url.searchParams.set("organisationId", organisationId);
  return `${url.pathname}${url.search}`;
}

function countLabel(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function StudioClientDetail({
  client,
}: StudioClientDetailProps): React.JSX.Element {
  const workspaceRows = [
    {
      action: "Create or review agreement",
      detail: countLabel(client.agreementCount, "agreement"),
      href: `/portal/admin/clients/${client.id}/agreements`,
      title: "Agreement & scope",
    },
    {
      action: "Open signing documents",
      detail: "Prepare, review, and track agreement documents",
      href: `/portal/admin/clients/${client.id}/signing`,
      title: "Agreement documents",
    },
    {
      action: "View journey",
      detail: countLabel(client.activeJourneyCount, "active journey"),
      href: `/portal/admin/clients/${client.id}/journey`,
      title: "Welcome journey",
    },
    {
      action: "Manage access",
      detail: `Primary contact: ${client.primaryContactName}`,
      href: adminHref("/portal/admin/portal-access", client.id),
      title: "People & access",
    },
    {
      action: "Open projects",
      detail: countLabel(client.activeProjectCount, "active project"),
      href: adminHref("/portal/admin/projects", client.id),
      title: "Projects & files",
    },
    {
      action: "Open billing",
      detail:
        client.billingExceptionCount > 0
          ? countLabel(client.billingExceptionCount, "billing exception")
          : "No open billing exceptions",
      href: adminHref("/portal/admin/billing", client.id),
      title: "Billing",
    },
    {
      action: "Open requests",
      detail: countLabel(client.openRequestCount, "open request"),
      href: `/portal/admin/clients/${client.id}/requests`,
      title: "Delivery requests",
    },
  ];

  return (
    <section className={styles.page} aria-labelledby="studio-client-heading">
      <PageHeader
        action={
          <PortalActionLink
            href={portalPath(`/portal/admin/clients/${client.id}/journey`)}
          >
            Prepare welcome
          </PortalActionLink>
        }
        breadcrumbs={[
          { href: portalPath("/portal/admin/clients"), label: "Clients" },
          { label: client.displayName },
        ]}
        description={`${client.legalName} · ${client.timezone}`}
        eyebrow="FSS Studio · Client context"
        title={client.displayName}
      />
      <PortalCard tone="accent">
        <div className={styles.row}>
          <div className={styles.rowCopy}>
            <h2>{client.nextAction}</h2>
            <p>
              This client record is {client.lifecycle}. Open the current action
              or use the workspace links below.
            </p>
          </div>
          <PortalActionLink href={portalPath(client.nextActionHref)}>
            {client.nextAction}
          </PortalActionLink>
        </div>
      </PortalCard>
      <dl className={styles.metrics} aria-label="Client delivery summary">
        <div>
          <dt>Active projects</dt>
          <dd>{client.activeProjectCount}</dd>
        </div>
        <div>
          <dt>Open requests</dt>
          <dd>{client.openRequestCount}</dd>
        </div>
        <div>
          <dt>Agreements</dt>
          <dd>{client.agreementCount}</dd>
        </div>
        <div>
          <dt>Record</dt>
          <dd>
            <StatusBadge
              status={client.lifecycle === "active" ? "info" : "neutral"}
            >
              {client.lifecycle}
            </StatusBadge>
          </dd>
        </div>
      </dl>
      <StudioClientCurrencyForm
        billingCurrency={client.billingCurrency}
        currencyVersion={client.currencyVersion}
        organisationId={client.id}
      />
      <section
        className={styles.workspace}
        aria-labelledby="client-workspace-heading"
      >
        <div className={styles.workspaceHeader}>
          <h2 id="client-workspace-heading">Client workspace</h2>
          <p>
            Keep client-specific follow-up in context while moving between
            delivery, agreements, access and billing.
          </p>
        </div>
        <ul className={styles.rows}>
          {workspaceRows.map((row) => (
            <li key={row.title}>
              <PortalCard>
                <div className={styles.row}>
                  <div className={styles.rowCopy}>
                    <h3>{row.title}</h3>
                    <p>{row.detail}</p>
                  </div>
                  <PortalActionLink
                    className={styles.rowAction}
                    href={portalPath(row.href)}
                    variant="secondary"
                  >
                    {row.action}
                  </PortalActionLink>
                </div>
              </PortalCard>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
