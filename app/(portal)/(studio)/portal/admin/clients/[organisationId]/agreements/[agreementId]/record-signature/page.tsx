import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { SignatureEvidenceForm } from "@/components/portal/agreements/signature-evidence-form";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { PageHeader } from "@/components/portal/ui";
import styles from "@/components/portal/agreements/agreements.module.css";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { getStaffAgreement } from "@/lib/operations/agreements/repository";

export const dynamic = "force-dynamic";

export default async function StaffSignatureEvidencePage({
  params,
}: {
  params: Promise<{ agreementId: string; organisationId: string }>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const { agreementId: rawAgreementId, organisationId: rawOrganisationId } =
    await params;
  const agreementId = z.uuid().safeParse(rawAgreementId);
  const organisationId = z.uuid().safeParse(rawOrganisationId);
  if (!agreementId.success || !organisationId.success) notFound();

  let record;
  try {
    const db = getOperationsDb();
    const admin = await requireFssAdmin(getPortalDb(), identity, randomUUID());
    record = await getStaffAgreement(
      db,
      admin,
      organisationId.data,
      agreementId.data,
    );
  } catch {
    return <PortalUnavailable />;
  }
  if (!record || record.status === "signed") notFound();

  const agreementWorkspaceHref = portalPath(
    `/portal/admin/clients/${organisationId.data}/agreements`,
  );
  const agreementHref = `${agreementWorkspaceHref}/${record.id}`;
  return (
    <div className={styles.page}>
      <PageHeader
        breadcrumbs={[
          {
            label: "Agreements",
            href: agreementWorkspaceHref,
          },
          { label: record.draft.title, href: agreementHref },
          { label: "Record signed evidence" },
        ]}
        description="Record reviewed evidence for the exact current revision without representing it as provider verification."
        eyebrow="FSS Studio / Agreements"
        title="Record a signed agreement"
      />
      <SignatureEvidenceForm
        endpoint={`/api/portal/admin/clients/${organisationId.data}/agreements`}
        organisationId={organisationId.data}
        record={record}
      />
    </div>
  );
}
