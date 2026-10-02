import { notFound } from "next/navigation";
import { StudioClientForm } from "@/components/portal/studio/client-form";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { loadActiveStudioSettings } from "@/lib/operations/studio/settings";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";

export default async function AdminClientCreatePage(): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  let defaultTimezone: string;
  try {
    const admin = await requireFssAdmin(getPortalDb(), identity, randomUUID());
    const settings = await loadActiveStudioSettings(getOperationsDb(), admin);
    defaultTimezone = settings.timezone;
  } catch {
    return <PortalUnavailable />;
  }
  return <StudioClientForm defaultTimezone={defaultTimezone} />;
}
