import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import styles from "@/components/portal/studio-client.module.css";
import { RequestDetail } from "@/components/portal/requests/request-detail";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { getStaffClientRequest } from "@/lib/operations/requests/staff-client-repository";

export const dynamic = "force-dynamic";

export default async function AdminClientRequestPage({
  params,
}: {
  params: Promise<{ organisationId: string; requestId: string }>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const parsed = z
    .object({ organisationId: z.uuid(), requestId: z.uuid() })
    .safeParse(await params);
  if (!parsed.success) notFound();
  let request;
  try {
    const db = getOperationsDb();
    const admin = await requireFssAdmin(db, identity, randomUUID());
    request = await getStaffClientRequest(
      db,
      admin,
      parsed.data.organisationId,
      parsed.data.requestId,
    );
  } catch {
    return <PortalUnavailable />;
  }
  if (!request) notFound();
  const { internalComments, priority, ...clientRequest } = request;
  return (
    <section className={styles.page} aria-labelledby="staff-request-heading">
      <Link
        className={styles.backLink}
        href={`/admin/clients/${parsed.data.organisationId}/requests`}
      >
        All client requests
      </Link>
      <header className={styles.hero}>
        <p id="staff-request-heading" className={styles.eyebrow}>
          FSS Studio · Delivery · {priority} priority
        </p>
      </header>
      <div>
          <RequestDetail
            request={clientRequest}
            organisationId={parsed.data.organisationId}
            canComment={false}
            hidePortalActions
          />
      </div>
      <section className={styles.workspace} aria-labelledby="internal-notes-heading">
          <h2 id="internal-notes-heading" className={styles.sectionTitle}>
            Internal notes
          </h2>
          {internalComments.length === 0 ? (
            <p className={styles.rowCopy}>No internal notes.</p>
          ) : (
            <ul className={styles.rowList}>
              {internalComments.map((comment) => (
                <li className={styles.row} key={comment.id}>
                  <div className={styles.rowContent}>
                    <h3 className={styles.rowTitle}>{comment.authorLabel}</h3>
                    <p className={styles.rowCopy}>{comment.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
      </section>
    </section>
  );
}
