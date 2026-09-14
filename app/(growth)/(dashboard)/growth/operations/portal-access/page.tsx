import { notFound } from "next/navigation";
import { PortalAccessDashboard } from "@/components/operations/clients/portal-access-dashboard";
import { requireFounder } from "@/lib/growth/auth/require-founder";
import { listPortalAccess } from "@/lib/operations/auth/repository";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";

export const dynamic = "force-dynamic";

export default async function PortalAccessPage(): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  const founder = await requireFounder();
  const data = await listPortalAccess(getOperationsDb(), founder);
  return <PortalAccessDashboard data={data} founderEmail={founder.email} />;
}
