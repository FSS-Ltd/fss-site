import Link from "next/link";
import type { StaffAgreementOverviewRow } from "@/lib/operations/agreements/repository";
import styles from "./staff-agreement-overview.module.css";

export function StaffAgreementOverview({
  agreements,
}: {
  agreements: StaffAgreementOverviewRow[];
}): React.JSX.Element {
  const totals = agreements.reduce(
    (result, organisation) => ({
      agreements: result.agreements + organisation.agreementCount,
      drafts: result.drafts + organisation.draftCount,
      signed: result.signed + organisation.signedCount,
    }),
    { agreements: 0, drafts: 0, signed: 0 },
  );

  return (
    <section
      className={styles.page}
      aria-labelledby="studio-agreements-heading"
    >
      <header className={styles.hero}>
        <p className={styles.eyebrow}>FSS Studio · Agreements</p>
        <h1 id="studio-agreements-heading" className={styles.title}>
          Agreement workspace
        </h1>
        <p className={styles.description}>
          Review client terms, prepare the exact signing document, and keep
          every revision in one operational record.
        </p>
      </header>
      <dl className={styles.metrics} aria-label="Agreement portfolio summary">
        <div>
          <dt>Client workspaces</dt>
          <dd>{agreements.length}</dd>
        </div>
        <div>
          <dt>Agreements</dt>
          <dd>{totals.agreements}</dd>
        </div>
        <div>
          <dt>Drafts to review</dt>
          <dd>{totals.drafts}</dd>
        </div>
        <div>
          <dt>Signed revisions</dt>
          <dd>{totals.signed}</dd>
        </div>
      </dl>
      {agreements.length === 0 ? (
        <section
          className={styles.empty}
          aria-labelledby="no-agreements-heading"
        >
          <h2 id="no-agreements-heading">No client workspaces yet</h2>
          <p>
            Client workspaces appear after an organisation has been registered
            for Operations.
          </p>
          <Link href="/admin/clients">Open client register</Link>
        </section>
      ) : (
        <ul className={styles.list} aria-label="Client agreement workspaces">
          {agreements.map((organisation) => (
            <li className={styles.row} key={organisation.organisationId}>
              <div>
                <h2>{organisation.organisationName}</h2>
                <p>
                  {organisation.draftCount > 0
                    ? `${organisation.draftCount} draft${organisation.draftCount === 1 ? "" : "s"} waiting for review.`
                    : "No draft agreement is waiting for review."}
                </p>
              </div>
              <dl className={styles.counts}>
                <div>
                  <dt>Agreements</dt>
                  <dd>{organisation.agreementCount}</dd>
                </div>
                <div>
                  <dt>Signed</dt>
                  <dd>{organisation.signedCount}</dd>
                </div>
              </dl>
              <Link
                className={styles.action}
                href={`/admin/clients/${organisation.organisationId}/agreements`}
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
