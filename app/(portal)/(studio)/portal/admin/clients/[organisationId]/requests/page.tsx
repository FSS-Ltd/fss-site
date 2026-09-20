import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import styles from "@/components/portal/studio-client.module.css";
import {
  requestDate,
  statusLabels,
} from "@/components/portal/requests/presentation";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { listStaffClientRequests } from "@/lib/operations/requests/staff-client-repository";
import { StudioPagination } from "@/components/portal/workspace/studio-pagination";
import { parseWorkspacePage } from "@/lib/operations/workspaces/pagination";

export const dynamic = "force-dynamic";

export default async function AdminClientRequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organisationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const parsed = z.uuid().safeParse((await params).organisationId);
  if (!parsed.success) notFound();
  let requests;
  try {
    const db = getOperationsDb();
    const admin = await requireFssAdmin(db, identity, randomUUID());
    requests = await listStaffClientRequests(db, admin, parsed.data, {
      page: parseWorkspacePage((await searchParams).page),
    });
  } catch {
    return <PortalUnavailable />;
  }
  return (
    <section className={styles.page} aria-labelledby="client-requests-heading">
      <Link className={styles.backLink} href={`/admin/clients/${parsed.data}`}>
        Client context
      </Link>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>FSS Studio · Delivery</p>
        <h1 id="client-requests-heading" className={styles.title}>
          Client requests
        </h1>
        <p className={styles.description}>
          Open work and follow-ups are ordered before completed requests.
        </p>
      </header>
      {requests.items.length === 0 ? (
        <p className={styles.rowCopy}>No client requests yet.</p>
      ) : (
        <ul className={styles.rowList}>
          {requests.items.map((request) => (
            <li className={styles.row} key={request.id}>
              <div className={styles.rowContent}>
                <h2 className={styles.rowTitle}>
                  {request.title} · {statusLabels[request.status]}
                </h2>
                <p className={styles.rowCopy}>
                  {request.nextAction ||
                    "Assess scope and confirm the next action."}
                </p>
                <p className={styles.rowCopy}>
                  Owner: {request.ownerDisplay || "Awaiting acknowledgement"} ·
                  Target: {requestDate(request.targetDate)}
                </p>
              </div>
              <Link
                className={styles.actionLink}
                href={`/admin/clients/${parsed.data}/requests/${request.id}`}
              >
                Open request
              </Link>
            </li>
          ))}
        </ul>
      )}
      <StudioPagination
        hasNext={requests.hasNext}
        page={requests.page}
        path={`/admin/clients/${parsed.data}/requests`}
      />
    </section>
  );
}
