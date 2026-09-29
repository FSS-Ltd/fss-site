import Link from "next/link";
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

function lifecycleStatus(
  lifecycle: StudioClient["lifecycle"],
): "info" | "neutral" {
  return lifecycle === "active" ? "info" : "neutral";
}

function activeWorkLabel(activeWorkCount: number): string {
  return `${activeWorkCount} active ${activeWorkCount === 1 ? "item" : "items"}`;
}

function contactInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (
    words
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "—"
  );
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
        eyebrow="FSS Studio · Clients"
        title="Your clients"
        titleId="studio-clients-heading"
      />
      <div className={styles.toolbar}>
        <form className={styles.search} method="get" role="search">
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
        <p className={styles.resultCount}>
          {clients.items.length} shown
          {clients.hasNext ? " · more available" : ""}
        </p>
      </div>
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
                      <span className={styles.clientMark} aria-hidden="true">
                        {contactInitials(client.primaryContactName)}
                      </span>
                      <h2>
                        <Link
                          href={portalPath(
                            `/portal/admin/clients/${client.id}`,
                          )}
                        >
                          {client.displayName}
                        </Link>
                      </h2>
                      <p>{client.legalName}</p>
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
                          <StatusBadge
                            status={lifecycleStatus(client.lifecycle)}
                          >
                            {client.lifecycle}
                          </StatusBadge>
                        </dd>
                      </div>
                    </dl>
                    <PortalActionLink
                      className={styles.rowAction}
                      href={portalPath(client.nextActionHref)}
                      variant="quiet"
                    >
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
