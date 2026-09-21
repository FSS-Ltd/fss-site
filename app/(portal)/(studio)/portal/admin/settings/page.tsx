import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { StudioSettings } from "@/components/portal/studio/studio-settings";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { loadStudioSettings } from "@/lib/operations/studio/settings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage(): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const settings = await (async () => {
    const db = getOperationsDb();
    const admin = await requireFssAdmin(db, identity, randomUUID());
    return loadStudioSettings(db, admin);
  })().catch(() => null);
  if (!settings) return <PortalUnavailable />;
  return <StudioSettings settings={settings} />;
}
