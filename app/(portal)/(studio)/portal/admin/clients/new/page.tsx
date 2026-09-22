import { notFound } from "next/navigation";
import { StudioClientForm } from "@/components/portal/studio/client-form";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { operationsEnabled } from "@/lib/operations/db/client";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";

export default async function AdminClientCreatePage(): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  try {
    await requireFssAdmin(getPortalDb(), identity, randomUUID());
  } catch {
    return <PortalUnavailable />;
  }
  return <StudioClientForm />;
}
