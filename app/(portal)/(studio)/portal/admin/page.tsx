import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { StudioOverview } from "@/components/portal/overview/studio-overview";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { loadStudioOverview } from "@/lib/operations/overview/studio-overview";

export const dynamic = "force-dynamic";

export default async function FssStudioPage(): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  let overview: Awaited<ReturnType<typeof loadStudioOverview>>;
  try {
    const db = getOperationsDb();
    const admin = await requireFssAdmin(db, identity, randomUUID());
    overview = await loadStudioOverview(db, admin);
  } catch {
    // Keep the existing non-disclosing portal response for non-staff users.
    return <PortalUnavailable />;
  }

  return <StudioOverview overview={overview} />;
}
