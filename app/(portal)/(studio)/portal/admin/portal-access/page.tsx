import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { PortalAccessWorkspace } from "@/components/portal/studio/portal-access-workspace";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { listStudioPortalAccess } from "@/lib/operations/studio/portal-access";
import { parseWorkspacePage } from "@/lib/operations/workspaces/pagination";

export const dynamic = "force-dynamic";

export default async function AdminPortalAccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const params = await searchParams;
  const data = await (async () => {
    const db = getOperationsDb();
    const admin = await requireFssAdmin(getPortalDb(), identity, randomUUID());
    return listStudioPortalAccess(db, admin, {
      page: parseWorkspacePage(params.page),
      query: Array.isArray(params.query) ? undefined : params.query,
      state:
        Array.isArray(params.state) || params.state === "all"
          ? undefined
          : params.state,
    });
  })().catch(() => null);
  if (!data) return <PortalUnavailable />;
  return <PortalAccessWorkspace data={data} />;
}
