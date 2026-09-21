import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import {
  getOperationsDb,
  operationsEnabled,
  type OperationsDb,
} from "@/lib/operations/db/client";
import { loadStaffOnboardingWorkspace } from "@/lib/operations/onboarding/queries";
import { onboardingEnabled } from "@/lib/operations/onboarding/worker-db";
import type { FssAdminContext } from "@/lib/operations/auth/staff-types";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { Notice, PageHeader, PortalActionLink } from "@/components/portal/ui";
import { JourneyTemplateEditor } from "./journey-template-editor";

type StaffTemplateEditorPageProps = Readonly<{
  initialTaskId?: string;
  initialTemplateId?: string;
  organisationId?: string;
}>;

function isUuid(value: string | undefined): value is string {
  return typeof value === "string" && z.uuid().safeParse(value).success;
}

export async function StaffTemplateEditorPage({
  initialTaskId,
  initialTemplateId,
  organisationId,
}: StaffTemplateEditorPageProps): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  if (initialTemplateId && !isUuid(initialTemplateId)) notFound();
  if (initialTaskId && !isUuid(initialTaskId)) notFound();
  if (!isUuid(organisationId)) {
    return (
      <main>
        <PageHeader
          description="Open a client workspace before creating or revising that client’s welcome template."
          eyebrow="FSS Studio · Welcome journeys"
          title="Choose a client template workspace"
        />
        <Notice tone="info">
          Templates are organisation-scoped. Select a client from the register
          so every checklist version has a clear owner.
        </Notice>
        <PortalActionLink href={portalPath("/portal/admin/clients")}>
          Open client register
        </PortalActionLink>
      </main>
    );
  }
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  let db: OperationsDb;
  let admin: FssAdminContext;
  try {
    db = getOperationsDb();
    admin = await requireFssAdmin(db, identity, randomUUID());
  } catch {
    return <PortalUnavailable />;
  }
  if (!onboardingEnabled()) {
    return (
      <main>
        <PageHeader
          description="Onboarding delivery must be enabled before template drafts can be prepared."
          eyebrow="FSS Studio · Welcome journeys"
          title="Welcome templates unavailable"
        />
        <Notice tone="info">
          No template version can be saved or published while onboarding is
          disabled.
        </Notice>
      </main>
    );
  }
  try {
    const workspace = await loadStaffOnboardingWorkspace(
      db,
      admin,
      organisationId,
    );
    const selectedTemplate = initialTemplateId
      ? workspace.templateDrafts.find(
          (template) => template.id === initialTemplateId,
        )
      : undefined;
    if (initialTemplateId && !selectedTemplate) return <PortalUnavailable />;
    if (
      initialTaskId &&
      !selectedTemplate?.tasks.some((task) => task.id === initialTaskId)
    ) {
      return <PortalUnavailable />;
    }
    return (
      <main>
        <PageHeader
          action={
            <PortalActionLink
              href={portalPath(
                `/portal/admin/clients/${organisationId}/journey`,
              )}
              variant="secondary"
            >
              Back to welcome journey
            </PortalActionLink>
          }
          description="Draft the client checklist, then publish a reviewed immutable version for future welcome journeys."
          eyebrow="FSS Studio · Welcome journeys"
          title="A consistent start, tailored to this client"
        />
        <JourneyTemplateEditor
          commandEndpoint={`/api/portal/admin/welcome/templates?organisationId=${organisationId}`}
          initialTaskId={initialTaskId}
          initialTemplateId={initialTemplateId}
          templates={workspace.templateDrafts}
        />
      </main>
    );
  } catch {
    return <PortalUnavailable />;
  }
}
