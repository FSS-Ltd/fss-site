import { notFound } from "next/navigation";
import { ClientList } from "@/components/operations/clients/client-list";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { listStaffOrganisations } from "@/lib/operations/organisations/staff-repository";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { randomUUID } from "node:crypto";
import type { OrganisationPage } from "@/lib/operations/organisations/types";
import { parseWorkspacePage } from "@/lib/operations/workspaces/pagination";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  let data: OrganisationPage;
  try {
    const page = parseWorkspacePage((await searchParams).page);
    const admin = await requireFssAdmin(
      getOperationsDb(),
      identity,
      randomUUID(),
    );
    data = await listStaffOrganisations(getOperationsDb(), admin, { page });
  } catch {
    return <PortalUnavailable />;
  }
  return (
    <ClientList
      state={{ status: "ready", data }}
      routePrefix="/admin/clients"
      showPortalAccess={false}
      workspaceContext="FSS Studio · Clients"
    />
  );
}
