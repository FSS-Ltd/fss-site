import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { SigningReview } from "@/components/operations/signing/signing-review";
import { SigningSummary } from "@/components/operations/signing/signing-summary";
import { OperationsPageHeader } from "@/components/operations/shared/operations-page-header";
import studio from "@/components/portal/studio-client.module.css";
import styles from "@/components/operations/agreements/agreements.module.css";
import signingStyles from "@/components/operations/signing/signing.module.css";
import ui from "@/components/operations/shared/operations-ui.module.css";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import type { FssAdminContext } from "@/lib/operations/auth/staff-types";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { signingEnabled } from "@/lib/operations/agreements/signing-commands";
import { listStaffSigning } from "@/lib/operations/agreements/signing-service";

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
    admin = await requireFssAdmin(getOperationsDb(), identity, randomUUID());
  } catch {
    return <PortalUnavailable />;
  }
  if (!signingEnabled()) {
    return (
      <section className={studio.page} aria-labelledby="signing-unavailable-heading">
        <h1 id="signing-unavailable-heading" className={studio.title}>
          Signing unavailable
        </h1>
        <p className={studio.rowCopy}>
          Signing delivery is not enabled. No documents or signature requests
          can be prepared from this workspace.
        </p>
      </section>
    );
  }
  let approvals;
  try {
    const db = getOperationsDb();
    approvals = await listStaffSigning(
      db,
      admin,
      organisationId.data,
      randomUUID(),
    );
  } catch {
    return <PortalUnavailable />;
  }
  const apiRoot = `/api/portal/admin/clients/${organisationId.data}/signing`;
  return (
    <section className={`${styles.page} ${signingStyles.operationsPage}`}>
      <OperationsPageHeader
        context="FSS Studio · Signing"
        title="Ready for agreement."
        description="Review the exact document, approve its signers, and follow each signature."
        action={
          <Link href={`/admin/clients/${organisationId.data}/agreements`}>
            Back to agreements
          </Link>
        }
      />
      <SigningSummary approvals={approvals} />
      {approvals.length === 0 && (
        <p className={ui.emptyState}>
          No signing requests yet. Prepare a document from the agreement
          workspace.
        </p>
      )}
      {approvals.map((approval) => (
        <SigningReview
          key={`${approval.id}-${approval.status}`}
          approval={approval}
          audience="staff"
          commandEndpoint={apiRoot}
          downloadBase={`${apiRoot}/${approval.id}`}
        />
      ))}
      {approvals.length === 100 && (
        <p>The latest 100 signing requests are shown.</p>
      )}
    </section>
  );
}
