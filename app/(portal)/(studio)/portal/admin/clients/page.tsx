import { notFound } from "next/navigation";
import { StudioClientRegister } from "@/components/portal/studio/client-register";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { listStudioClients } from "@/lib/operations/studio/clients";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { loadActiveStudioSettings } from "@/lib/operations/studio/settings";
import { randomUUID } from "node:crypto";

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
  const params = await searchParams;
  const query = typeof params.query === "string" ? params.query.trim() : "";
  let clients: Awaited<ReturnType<typeof listStudioClients>>;
  let defaultTimezone: string;
  try {
    const admin = await requireFssAdmin(getPortalDb(), identity, randomUUID());
    const db = getOperationsDb();
    const [clientPage, settings] = await Promise.all([
      listStudioClients(db, admin, { page: params.page, query: params.query }),
      loadActiveStudioSettings(db, admin),
    ]);
    clients = clientPage;
    defaultTimezone = settings.timezone;
  } catch {
    return <PortalUnavailable />;
  }
  return (
    <StudioClientRegister
      clients={clients}
      query={query}
      defaultTimezone={defaultTimezone}
    />
  );
}
