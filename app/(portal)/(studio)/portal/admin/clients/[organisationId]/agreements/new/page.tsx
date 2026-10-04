import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { RoutedStaffAgreementBuilder } from "@/components/portal/agreements/routed-staff-agreement-builder";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { PageHeader } from "@/components/portal/ui";
import styles from "@/components/portal/agreements/agreements.module.css";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { loadStaffAgreementBuilderDraft } from "@/lib/operations/agreements/builder-draft-service";
import { SavedAgreementDrafts } from "@/components/portal/agreements/saved-agreement-drafts";
import { listStaffAgreementBuilderDrafts } from "@/lib/operations/agreements/builder-draft-repository";
import { parseWorkspacePage } from "@/lib/operations/workspaces/pagination";
import { listStaffAgreementRegister } from "@/lib/operations/agreements/repository";

export const dynamic = "force-dynamic";

function parseDraftId(value: string | string[] | undefined): string | null {
  if (value === undefined) return null;
  if (Array.isArray(value)) notFound();
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) notFound();
  return parsed.data;
}

export default async function NewStaffAgreementPage({
  params,
  searchParams,
}: {
  params: Promise<{ organisationId: string }>;
  searchParams: Promise<{
    draftId?: string | string[];
    draftPage?: string | string[];
    new?: string | string[];
    step?: string | string[];
  }>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;

  const organisationId = z.uuid().safeParse((await params).organisationId);
  const query = await searchParams;
  const draftId = parseDraftId(query.draftId);
  const startNew = z.literal("1").optional().safeParse(query.new);
  if (!startNew.success || (draftId && query.new !== undefined)) notFound();
  let draftPage;
  try {
    draftPage = parseWorkspacePage(query.draftPage);
  } catch {
    notFound();
  }
  if (!organisationId.success) notFound();

  let register;
  let initialDraft;
  let savedDrafts;
  try {
    const db = getOperationsDb();
    const admin = await requireFssAdmin(getPortalDb(), identity, randomUUID());
    register = await listStaffAgreementRegister(db, admin, organisationId.data);
    if (!draftId && startNew.data !== "1")
      savedDrafts = await listStaffAgreementBuilderDrafts(
        db,
        admin,
        organisationId.data,
        draftPage,
      );
    initialDraft = draftId
      ? await loadStaffAgreementBuilderDraft(
          db,
          admin,
          organisationId.data,
          draftId,
        )
      : null;
  } catch {
    return <PortalUnavailable />;
  }
  if (!register || (draftId && !initialDraft)) notFound();

  const agreementListHref = portalPath(
    `/portal/admin/clients/${organisationId.data}/agreements`,
  );
  const baseHref = `${agreementListHref}/new`;
  const engagementQuery = draftId
    ? `?${new URLSearchParams({ draftId }).toString()}`
    : "";
  const engagementHref = portalPath(
    `/portal/admin/clients/${organisationId.data}/engagements/new${engagementQuery}`,
  );

  return (
    <div className={styles.page}>
      <PageHeader
        breadcrumbs={[
          { label: "Clients", href: portalPath("/portal/admin/clients") },
          {
            label: register.organisationName,
            href: portalPath(`/portal/admin/clients/${organisationId.data}`),
          },
          { label: "Agreements", href: agreementListHref },
          { label: "Create agreement" },
        ]}
        description="Build a complete agreement from reviewed work. The server checks the saved draft again before it creates an agreement record."
        eyebrow="FSS Studio / Agreements"
        title="Create an agreement"
      />
      {savedDrafts && (savedDrafts.items.length > 0 || savedDrafts.page > 1) ? (
        <SavedAgreementDrafts
          drafts={savedDrafts}
          builderHref={baseHref}
          listHref={baseHref}
          startNewHref={`${baseHref}?new=1`}
        />
      ) : (
        <RoutedStaffAgreementBuilder
          agreementListHref={agreementListHref}
          baseHref={baseHref}
          commandEndpoint={`/api/portal/admin/clients/${organisationId.data}/agreement-drafts`}
          engagementHref={engagementHref}
          engagements={register.engagementChoices ?? []}
          initialDraft={initialDraft}
          organisationName={register.organisationName}
          currency={register.billingCurrency}
        />
      )}
    </div>
  );
}
