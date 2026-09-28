import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import {
  PageHeader,
  PortalActionLink,
  PortalCard,
} from "@/components/portal/ui";
import { NewStudioProjectForm } from "@/components/portal/studio/new-project-form";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { listStaffAgreementRegister } from "@/lib/operations/agreements/repository";
import { portalPath } from "@/lib/operations/auth/portal-url";

export const dynamic = "force-dynamic";

export default async function NewAdminProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ organisationId?: string | string[] }>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const rawOrganisationId = (await searchParams).organisationId;
  if (typeof rawOrganisationId !== "string") notFound();
  const organisationId = z.uuid().safeParse(rawOrganisationId);
  if (!organisationId.success) notFound();
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;

  let register;
  try {
    const admin = await requireFssAdmin(getPortalDb(), identity, randomUUID());
    register = await listStaffAgreementRegister(
      getOperationsDb(),
      admin,
      organisationId.data,
    );
  } catch {
    return <PortalUnavailable />;
  }
  if (!register) notFound();
  const agreements = register.agreements.map((record) => ({
    id: record.id,
    title: record.draft.title,
  }));
  if (!agreements.length) {
    return (
      <main>
        <PageHeader
          description={`${register.organisationName} does not have a saved agreement yet.`}
          eyebrow="FSS Studio · Projects"
          title="Start with an agreement"
        />
        <PortalCard title="Plan delivery after the agreement is saved">
          <p>
            The project will stay linked to reviewed client scope. You can
            prepare a welcome journey before creating a project.
          </p>
          <PortalActionLink
            href={portalPath(
              `/portal/admin/clients/${organisationId.data}/agreements/new`,
            )}
            variant="primary"
          >
            Set up an agreement
          </PortalActionLink>
        </PortalCard>
      </main>
    );
  }
  return (
    <NewStudioProjectForm
      agreements={agreements}
      organisationId={organisationId.data}
      organisationName={register.organisationName}
    />
  );
}
