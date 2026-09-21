import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EngagementForm } from "@/components/portal/agreements/engagement-form";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { PageHeader } from "@/components/portal/ui";
import styles from "@/components/portal/agreements/agreements.module.css";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { listStaffAgreementRegister } from "@/lib/operations/agreements/repository";

export const dynamic = "force-dynamic";

export default async function StaffEngagementPage({
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

  let register;
  try {
    const db = getOperationsDb();
    const admin = await requireFssAdmin(db, identity, randomUUID());
    register = await listStaffAgreementRegister(db, admin, organisationId.data);
  } catch {
    return <PortalUnavailable />;
  }
  if (!register) notFound();

  const agreementHref = portalPath(
    `/portal/admin/clients/${organisationId.data}/agreements`,
  );
  return (
    <div className={styles.page}>
      <PageHeader
        breadcrumbs={[
          { label: "Agreements", href: agreementHref },
          { label: "Engagement provenance" },
        ]}
        description="Only reviewed organisation mappings can become agreement work."
        eyebrow="FSS Studio / Agreements"
        title="Create an engagement"
      />
      <EngagementForm
        agreementHref={agreementHref}
        engagementChoices={register.engagementChoices ?? []}
      />
    </div>
  );
}
