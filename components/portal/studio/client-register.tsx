import {
  PageHeader,
  PortalActionLink,
  PortalButton,
  PortalCard,
  PortalField,
  StatusBadge,
} from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import type { StudioClient } from "@/lib/operations/studio/clients";
import type { WorkspaceCollectionPage } from "@/lib/operations/workspaces/pagination";
import styles from "./client-register.module.css";

type StudioClientRegisterProps = Readonly<{
  clients: WorkspaceCollectionPage<StudioClient>;
  query: string;
}>;

function clientsHref(page: number, query: string): string {
  const search = new URLSearchParams({ page: String(page) });
  if (query) search.set("query", query);
  return portalPath(`/portal/admin/clients?${search.toString()}`);
}

function lifecycleStatus(lifecycle: StudioClient["lifecycle"]): "info" | "neutral" {
  return lifecycle === "active" ? "info" : "neutral";
}

function activeWorkLabel(activeWorkCount: number): string {
  return `${activeWorkCount} active ${activeWorkCount === 1 ? "item" : "items"}`;
}

export function StudioClientRegister({
  clients,
  query,
}: StudioClientRegisterProps): React.JSX.Element {
  return (
    <section className={styles.page} aria-labelledby="studio-clients-heading">
      <PageHeader
        action={
          <PortalActionLink href={portalPath("/portal/admin/clients/new")}>
            Add client
          </PortalActionLink>
        }
        description="Relationships, delivery and commercial readiness in one staff-scoped register."
        eyebrow="FSS Studio · Clients"
        title="Your clients"
      />
      <PortalCard
        description="Search display and legal names. Your search stays in the register while you move between pages."
        title="Client register"
      >
        <form className={styles.search} method="get">
          <PortalField label="Search clients">
            <input
              defaultValue={query}
              maxLength={100}
              name="query"
              type="search"
            />
          </PortalField>
          <PortalButton type="submit" variant="secondary">
            Search
          </PortalButton>
        </form>
      </PortalCard>
      <section className={styles.register} aria-label="Client register results">
        {clients.items.length === 0 ? (
          <PortalCard title="No matching clients">
            <p className={styles.empty}>
              Try another name or clear the search to return to the full client
              register.
            </p>
          </PortalCard>
        ) : (
          <ul className={styles.list}>
            {clients.items.map((client) => (
              <li key={client.id}>
                <PortalCard>
                  <div className={styles.row}>
                    <div className={styles.rowSummary}>
                      <h2>{client.displayName}</h2>
                      <p>{client.legalName}</p>
                      <PortalActionLink
                        className={styles.rowAction}
                        href={portalPath(`/portal/admin/clients/${client.id}`)}
                        variant="quiet"
                      >
                        Open client
                      </PortalActionLink>
                    </div>
                    <dl className={styles.rowMeta}>
                      <div>
                        <dt>Primary contact</dt>
                        <dd>{client.primaryContactName}</dd>
                      </div>
                      <div>
                        <dt>Active work</dt>
                        <dd>{activeWorkLabel(client.activeWorkCount)}</dd>
                      </div>
                      <div>
                        <dt>Record</dt>
                        <dd>
                          <StatusBadge status={lifecycleStatus(client.lifecycle)}>
                            {client.lifecycle}
                          </StatusBadge>
                        </dd>
                      </div>
                    </dl>
                    <PortalActionLink href={portalPath(client.nextActionHref)}>
                      {client.nextAction}
                    </PortalActionLink>
                  </div>
                </PortalCard>
              </li>
            ))}
          </ul>
        )}
      </section>
      {(clients.page > 1 || clients.hasNext) && (
        <nav className={styles.pagination} aria-label="Client register pages">
          {clients.page > 1 ? (
            <PortalActionLink
              href={clientsHref(clients.page - 1, query)}
              variant="secondary"
            >
              Previous page
            </PortalActionLink>
          ) : (
            <span />
          )}
          {clients.hasNext ? (
            <PortalActionLink
              href={clientsHref(clients.page + 1, query)}
              variant="secondary"
            >
              Next page
            </PortalActionLink>
          ) : (
            <span />
          )}
        </nav>
      )}
    </section>
  );
}
