import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { StaffAgreementDetail } from "@/components/portal/agreements/staff-agreement-detail";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { PageHeader } from "@/components/portal/ui";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { getStaffAgreement } from "@/lib/operations/agreements/repository";
import styles from "@/components/portal/agreements/agreements.module.css";

export const dynamic = "force-dynamic";

export default async function StaffAgreementPage({
  params,
}: {
  params: Promise<{ agreementId: string; organisationId: string }>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const { agreementId: rawAgreementId, organisationId: rawOrganisationId } = await params;
  const agreementId = z.uuid().safeParse(rawAgreementId);
  const organisationId = z.uuid().safeParse(rawOrganisationId);
  if (!agreementId.success || !organisationId.success) notFound();

  let record;
  try {
    const db = getOperationsDb();
    const admin = await requireFssAdmin(db, identity, randomUUID());
    record = await getStaffAgreement(db, admin, organisationId.data, agreementId.data);
  } catch {
    return <PortalUnavailable />;
  }
  if (!record) notFound();

  const workspaceHref = `/admin/clients/${organisationId.data}/agreements`;
  return (
    <div className={styles.page}>
      <PageHeader
        breadcrumbs={[
          { label: "Agreements", href: workspaceHref },
          { label: record.draft.title },
        ]}
        description={`Revision ${record.revision} is retained independently from every later draft.`}
        eyebrow="FSS Studio / Agreements"
        title={record.draft.title}
      />
      <StaffAgreementDetail organisationId={organisationId.data} record={record} />
    </div>
  );
}
