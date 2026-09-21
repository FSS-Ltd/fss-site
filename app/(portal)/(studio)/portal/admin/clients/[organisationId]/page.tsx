import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { StudioClientDetail } from "@/components/portal/studio/client-detail";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { loadStudioClient } from "@/lib/operations/studio/clients";

export const dynamic = "force-dynamic";

export default async function AdminClientContextPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const parsed = z.uuid().safeParse((await params).organisationId);
  if (!parsed.success) notFound();
  const db = getOperationsDb();
  let client;
  try {
    const admin = await requireFssAdmin(db, identity, randomUUID());
    client = await loadStudioClient(db, admin, parsed.data);
  } catch {
    return <PortalUnavailable />;
  }
  if (!client) notFound();
  return <StudioClientDetail client={client} />;
}
