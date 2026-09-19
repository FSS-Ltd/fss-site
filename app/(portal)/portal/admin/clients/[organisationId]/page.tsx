import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import styles from "@/components/portal/studio-client.module.css";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import {
  getStaffClientContext,
  listStaffClientRequests,
} from "@/lib/operations/requests/staff-client-repository";

export const dynamic = "force-dynamic";

export default async function AdminClientContextPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const parsed = z.uuid().safeParse((await params).organisationId);
  if (!parsed.success) notFound();
  const db = getOperationsDb();
  let client;
  let requests;
  try {
    const admin = await requireFssAdmin(db, identity, randomUUID());
    [client, requests] = await Promise.all([
      getStaffClientContext(db, admin, parsed.data),
      listStaffClientRequests(db, admin, parsed.data),
    ]);
  } catch {
    return <PortalUnavailable />;
  }
  if (!client) notFound();
  return (
    <section className={styles.page} aria-labelledby="client-context-heading">
      <Link className={styles.backLink} href="/admin/clients">
        Client register
      </Link>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>FSS Studio · Client context</p>
        <h1 id="client-context-heading" className={styles.title}>
          {client.displayName}
        </h1>
        <p className={styles.description}>
          {client.legalName} · {client.timezone} · {client.lifecycle} record.
        </p>
        <Link
          className={styles.actionLink}
          href={`/admin/clients/${client.id}/requests`}
        >
          Open client requests
        </Link>
      </header>
      <dl className={styles.metricGrid} aria-label="Client delivery summary">
        <div className={styles.metric}>
          <dt className={styles.metricLabel}>Projects</dt>
          <dd className={styles.metricValue}>{client.projectCount}</dd>
        </div>
        <div className={styles.metric}>
          <dt className={styles.metricLabel}>Open requests</dt>
          <dd className={styles.metricValue}>{client.openRequestCount}</dd>
        </div>
        <div className={styles.metric}>
          <dt className={styles.metricLabel}>Engagement links</dt>
          <dd className={styles.metricValue}>{client.engagementCount}</dd>
        </div>
      </dl>
      <section
        className={styles.workspace}
        aria-labelledby="client-work-heading"
      >
        <h2 id="client-work-heading" className={styles.sectionTitle}>
          Client workspace
        </h2>
        <ul className={styles.rowList}>
          <li className={styles.row}>
            <div className={styles.rowContent}>
              <h3 className={styles.rowTitle}>Delivery requests</h3>
              <p className={styles.rowCopy}>
                {requests.length}{" "}
                {requests.length === 1 ? "request" : "requests"} in the current
                delivery queue.
              </p>
            </div>
            <Link
              className={styles.actionLink}
              href={`/admin/clients/${client.id}/requests`}
            >
              Open requests
            </Link>
          </li>
          <li className={styles.row}>
            <div className={styles.rowContent}>
              <h3 className={styles.rowTitle}>Agreement &amp; scope</h3>
              <p className={styles.rowCopy}>
                Build immutable agreement revisions and prepare the exact
                document for signing.
              </p>
            </div>
            <Link
              className={styles.actionLink}
              href={`/admin/clients/${client.id}/agreements`}
            >
              Open agreements
            </Link>
          </li>
          <li className={styles.row}>
            <div className={styles.rowContent}>
              <h3 className={styles.rowTitle}>Welcome journey</h3>
              <p className={styles.rowCopy}>
                Prepare approved messages, signing access, and scheduled
                activation with recovery evidence.
              </p>
            </div>
            <Link
              className={styles.actionLink}
              href={`/admin/clients/${client.id}/journey`}
            >
              Open journeys
            </Link>
          </li>
          {[
            [
              "People & access",
              "Portal access is managed by the founder in Growth Operations.",
            ],
            [
              "Projects & files",
              "Project and document migration is not available in FSS Studio yet.",
            ],
            [
              "Billing",
              "Billing migration is not available in FSS Studio yet.",
            ],
          ].map(([title, detail]) => (
            <li className={styles.row} key={title}>
              <div className={styles.rowContent}>
                <h3 className={styles.rowTitle}>{title}</h3>
                <p className={styles.rowCopy}>{detail}</p>
              </div>
              <span className={styles.unavailable}>Unavailable</span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
