import { randomUUID } from "node:crypto";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { loadActiveStudioSettings } from "@/lib/operations/studio/settings";
import { StudioShell } from "@/components/portal/shell/studio-shell";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
  fssStudioEnabled,
  prefixFreePortalEnabled,
} from "@/lib/operations/auth/release-flags";
import {
  isPortalAppearance,
  PORTAL_APPEARANCE_COOKIE,
} from "@/lib/operations/design/portal-appearance";

async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  if (!fssStudioEnabled() || !operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const settings = await (async () => {
    const admin = await requireFssAdmin(getPortalDb(), identity, randomUUID());
    return loadActiveStudioSettings(getOperationsDb(), admin);
  })().catch(() => null);
  if (!settings) return <PortalUnavailable />;
  const appearanceCookie = (await cookies()).get(
    PORTAL_APPEARANCE_COOKIE,
  )?.value;
  const initialAppearance = isPortalAppearance(appearanceCookie)
    ? appearanceCookie
    : "system";
  return (
    <StudioShell
      studioSettings={settings}
      initialAppearance={initialAppearance}
      prefixFreeEnabled={prefixFreePortalEnabled()}
    >
      {children}
    </StudioShell>
  );
}

export default AdminLayout;
