import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { SigningForm } from "@/components/operations/signing/signing-form";
import { StaffSigningStatus } from "@/components/portal/agreements/staff-signing-status";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import {
  Notice,
  PageHeader,
  PortalActionLink,
  PortalCard,
} from "@/components/portal/ui";
import styles from "@/components/portal/agreements/agreements.module.css";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import type { FssAdminContext } from "@/lib/operations/auth/staff-types";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { signingEnabled } from "@/lib/operations/agreements/signing-commands";
import { listStaffSigning } from "@/lib/operations/agreements/signing-service";
import { listStaffAgreementDeliveries } from "@/lib/operations/agreements/agreement-notification-repository";

export const dynamic = "force-dynamic";

export default async function StaffClientSigningPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const organisationId = z.uuid().safeParse((await params).organisationId);
  if (!organisationId.success) notFound();
  let admin: FssAdminContext;
  try {
    admin = await requireFssAdmin(getPortalDb(), identity, randomUUID());
  } catch {
    return <PortalUnavailable />;
  }
  if (!signingEnabled()) {
    return (
      <section
        className={styles.page}
        aria-labelledby="signing-unavailable-heading"
      >
        <h1 id="signing-unavailable-heading">Signing unavailable</h1>
        <p className={styles.prose}>
          Signing delivery is not enabled. No documents or signature requests
          can be prepared from this workspace.
        </p>
      </section>
    );
  }
  let approvals;
  let deliveries;
  try {
    const db = getOperationsDb();
    approvals = await listStaffSigning(
      db,
      admin,
      organisationId.data,
      randomUUID(),
    );
    deliveries = await listStaffAgreementDeliveries(
      db,
      admin,
      organisationId.data,
    );
  } catch {
    return <PortalUnavailable />;
  }
  const apiRoot = `/api/portal/admin/clients/${organisationId.data}/signing`;
  const agreementHref = portalPath(
    `/portal/admin/clients/${organisationId.data}/agreements`,
  );
  return (
    <div className={styles.page}>
      <PageHeader
        action={
          <PortalActionLink href={agreementHref} variant="secondary">
            Back to agreements
          </PortalActionLink>
        }
        breadcrumbs={[
          { label: "Agreements", href: agreementHref },
          { label: "Signing" },
        ]}
        description="Review the retained document, approve named signers and keep delivery facts separate from signature evidence."
        eyebrow="FSS Studio / Agreements"
        title="Signing status"
      />
      {approvals.length === 0 ? (
        <PortalCard
          description="Prepare a document from an agreement record before it appears here."
          title="No signing requests yet"
        >
          <PortalActionLink href={agreementHref} variant="secondary">
            Open agreements
          </PortalActionLink>
        </PortalCard>
      ) : (
        approvals.map((approval) => {
          const signingOpen =
            approval.status === "prepared" || approval.status === "approved";
          return (
            <section
              className={styles.detail}
              key={`${approval.id}-${approval.status}`}
            >
              <StaffSigningStatus
                approval={approval}
                deliveries={deliveries.filter(
                  (delivery) => delivery.approvalId === approval.id,
                )}
                downloadBase={`${apiRoot}/${approval.id}`}
                commandEndpoint={apiRoot}
                controls={
                  signingOpen ? (
                    <PortalCard
                      description="Review the retained document and named signers before approval. Approval opens signing but does not record a signature."
                      title={
                        approval.status === "prepared"
                          ? "Approve signing"
                          : approval.signatures.length ===
                              approval.requiredSigners.length
                            ? "Complete signed copy"
                            : "Signing controls"
                      }
                    >
                      <SigningForm
                        approval={approval}
                        audience="staff"
                        commandEndpoint={apiRoot}
                        organisationId={organisationId.data}
                      />
                    </PortalCard>
                  ) : undefined
                }
              />
            </section>
          );
        })
      )}
      {approvals.length === 100 ? (
        <Notice tone="info">
          <p>The latest 100 signing requests are shown.</p>
        </Notice>
      ) : null}
    </div>
  );
}
