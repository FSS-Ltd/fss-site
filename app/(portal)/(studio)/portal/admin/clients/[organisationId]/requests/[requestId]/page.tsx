import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { RequestDetail } from "@/components/portal/requests/request-detail";
import { StaffRequestActions } from "@/components/portal/requests/staff-request-actions";
import { PageHeader, PortalCard } from "@/components/portal/ui";
import styles from "@/components/portal/requests/requests.module.css";
import { founderDeliveryOwnerId } from "@/lib/operations/requests/types";
import { listAgreementRegister } from "@/lib/operations/agreements/repository";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { getStaffClientRequest } from "@/lib/operations/requests/staff-client-repository";

export const dynamic = "force-dynamic";

export default async function AdminClientRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ organisationId: string; requestId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const parsed = z
    .object({ organisationId: z.uuid(), requestId: z.uuid() })
    .safeParse(await params);
  if (!parsed.success) notFound();
  let request, register;
  try {
    const db = getOperationsDb();
    const admin = await requireFssAdmin(db, identity, randomUUID());
    request = await getStaffClientRequest(
      db,
      admin,
      parsed.data.organisationId,
      parsed.data.requestId,
    );
    register = await listAgreementRegister(
      db,
      { actorId: admin.actorId },
      parsed.data.organisationId,
    );
  } catch {
    return <PortalUnavailable />;
  }
  if (!request) notFound();
  const query = await searchParams;
  const requestedAction = Array.isArray(query.action)
    ? query.action[0]
    : query.action;
  const { internalComments, priority, ...clientRequest } = request;
  return (
    <div className={styles.requestPage}>
      <PageHeader
        breadcrumbs={[
          { label: "Delivery", href: "/admin/delivery" },
          {
            label: "Client requests",
            href: `/admin/clients/${parsed.data.organisationId}/requests`,
          },
          { label: clientRequest.title },
        ]}
        description="Manage the client-visible delivery record and the founder-only operational controls separately."
        eyebrow={`FSS Studio / Delivery / ${priority} priority`}
        title={clientRequest.title}
      />
      <div className={styles.deliveryWorkspace}>
        <div>
          <RequestDetail
            canComment={false}
            hideTitle
            hidePortalActions
            organisationId={parsed.data.organisationId}
            request={clientRequest}
          />
        </div>
        <div className={styles.deliveryControls}>
          <StaffRequestActions
            deliveryOwners={[
              { id: founderDeliveryOwnerId, label: "FSS delivery" },
            ]}
            agreements={(register?.agreements ?? [])
              .filter((agreement) => agreement.status === "signed")
              .map((agreement) => ({
                id: agreement.id,
                label: agreement.draft.title,
              }))}
            currentPriority={priority}
            initialAction={requestedAction}
            organisationId={parsed.data.organisationId}
            request={clientRequest}
          />
          <PortalCard title="Internal notes">
            {internalComments.length === 0 ? (
              <p className={styles.note}>No internal notes.</p>
            ) : (
              <ul className={styles.history}>
                {internalComments.map((comment) => (
                  <li key={comment.id}>
                    <h3 className={styles.author}>{comment.authorLabel}</h3>
                    <p className={styles.prose}>{comment.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </PortalCard>
        </div>
      </div>
    </div>
  );
}
