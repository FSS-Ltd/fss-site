import Link from "next/link";
import type { OrganisationPage } from "@/lib/operations/organisations/types";
import styles from "./client-list.module.css";

export type ClientListState =
  | { status: "ready"; data: OrganisationPage }
  | { status: "error"; message: string };

export function ClientList({
  state,
}: {
  state: ClientListState;
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
