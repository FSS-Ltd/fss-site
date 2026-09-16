import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { statusLabels } from "@/components/portal/requests/presentation";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { listStaffDeliveryQueue } from "@/lib/operations/requests/staff-repository";
import styles from "@/components/portal/auth/portal.module.css";

export const dynamic = "force-dynamic";

export default async function AdminDeliveryPage(): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  let requests;
  try {
    const admin = await requireFssAdmin(getOperationsDb(), identity, randomUUID());
    requests = await listStaffDeliveryQueue(getOperationsDb(), admin);
  } catch {
    return <PortalUnavailable />;
  }
  return (
    <section aria-labelledby="delivery-heading">
      <p className={styles.eyebrow}>FSS Studio · Delivery</p>
      <h1 id="delivery-heading" className={styles.heading}>Delivery queue</h1>
      <p className={styles.copy}>Cross-client requests ordered so open work and overdue follow-ups stay visible.</p>
      {requests.length === 0 ? <p className={styles.actions}>No active client requests.</p> : (
        <ul className={styles.list}>
          {requests.map((request) => (
            <li className={styles.row} key={request.id}>
              <p className={styles.eyebrow}>{request.organisationName}</p>
              <h2 className={styles.name}>{request.title}</h2>
              <p className={styles.copy}>{statusLabels[request.status]} · {request.nextAction || "No next action recorded."}</p>
              <p className={styles.actions}><Link className={styles.link} href={`/admin/clients/${request.organisationId}/requests/${request.id}`}>Open request</Link></p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
