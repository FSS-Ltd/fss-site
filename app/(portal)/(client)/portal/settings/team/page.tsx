import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { OrganisationTeamInvitation } from "@/components/portal/auth/organisation-team-invitation";
import { ClientTeamWorkspace } from "@/components/portal/workspace/client-team-workspace";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { requirePortalMember } from "@/lib/operations/auth/require-member";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { listPortalTeamMembers } from "@/lib/operations/workspaces/portal-repository";

export const dynamic = "force-dynamic";

export default async function SettingsTeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const context = await getPortalPageContext(
    (await searchParams).organisationId,
  );
  if (!context) return <PortalUnavailable />;
  let members: Awaited<ReturnType<typeof listPortalTeamMembers>>;
  let membership: Awaited<ReturnType<typeof requirePortalMember>>;
  try {
    const db = getPortalDb();
    const correlationId = randomUUID();
    [members, membership] = await Promise.all([
      listPortalTeamMembers(
        db,
        context.identity,
        context.organisationId,
        correlationId,
      ),
      requirePortalMember(
        db,
        context.identity,
        context.organisationId,
        correlationId,
      ),
    ]);
  } catch (error) {
    if (error instanceof PortalAccessDenied) notFound();
    return <PortalUnavailable />;
  }
  return (
    <ClientTeamWorkspace
      invitation={
        <OrganisationTeamInvitation organisationId={context.organisationId} />
      }
      members={members}
      organisationId={context.organisationId}
      role={membership.role}
    />
  );
}
