import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { RoutedEngagementForm } from "@/components/portal/agreements/routed-engagement-form";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { PageHeader } from "@/components/portal/ui";
import styles from "@/components/portal/agreements/agreements.module.css";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { listStaffAgreementRegister } from "@/lib/operations/agreements/repository";
import { loadStaffAgreementBuilderDraft } from "@/lib/operations/agreements/builder-draft-service";

export const dynamic = "force-dynamic";

export default async function StaffEngagementPage({
  params,
  searchParams,
}: {
  params: Promise<{ organisationId: string }>;
  searchParams: Promise<{
    draftId?: string | string[];
    expectedVersion?: string | string[];
  }>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const organisationId = z.uuid().safeParse((await params).organisationId);
  if (!organisationId.success) notFound();
  const rawDraftId = (await searchParams).draftId;
  const rawExpectedVersion = (await searchParams).expectedVersion;
  if (Array.isArray(rawDraftId)) notFound();
  if (Array.isArray(rawExpectedVersion)) notFound();
  const draftId = rawDraftId ? z.uuid().safeParse(rawDraftId) : null;
  if (rawDraftId && !draftId?.success) notFound();
  const expectedVersion =
    rawExpectedVersion === undefined
      ? null
      : z.coerce.number().int().positive().safeParse(rawExpectedVersion);
  if (rawExpectedVersion !== undefined && !expectedVersion?.success) notFound();
  if (Boolean(draftId) !== Boolean(expectedVersion)) notFound();

  let register;
  let initialDraft;
  try {
    const db = getOperationsDb();
    const admin = await requireFssAdmin(getPortalDb(), identity, randomUUID());
    register = await listStaffAgreementRegister(db, admin, organisationId.data);
    initialDraft = draftId?.success
      ? await loadStaffAgreementBuilderDraft(
          db,
          admin,
          organisationId.data,
          draftId.data,
        )
      : null;
  } catch {
    return <PortalUnavailable />;
  }
  if (
    !register ||
    (draftId?.success &&
      (!initialDraft || initialDraft.version !== expectedVersion?.data))
  )
    notFound();

  const agreementBaseHref = portalPath(
    `/portal/admin/clients/${organisationId.data}/agreements`,
  );
  const agreementHref = draftId?.success
    ? `${agreementBaseHref}/new?${new URLSearchParams({ draftId: draftId.data }).toString()}`
    : `${agreementBaseHref}/new`;
  const agreementBuilderHref = portalPath(
    `/portal/admin/clients/${organisationId.data}/agreements/new`,
  );
  return (
    <div className={styles.page}>
      <PageHeader
        breadcrumbs={[
          { label: "Agreements", href: agreementBaseHref },
          { label: "Engagement provenance" },
        ]}
        description="Only reviewed organisation mappings can become agreement work."
        eyebrow="FSS Studio / Agreements"
        title="Create an engagement"
      />
      <RoutedEngagementForm
        agreementHref={agreementHref}
        commandEndpoint={`/api/portal/admin/clients/${organisationId.data}/engagements`}
        draft={
          initialDraft
            ? { id: initialDraft.id, version: initialDraft.version }
            : null
        }
        engagementChoices={register.engagementChoices ?? []}
        organisationName={register.organisationName}
        returnBaseHref={agreementBuilderHref}
      />
    </div>
  );
}
