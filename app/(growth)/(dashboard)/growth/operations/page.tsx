import { notFound } from "next/navigation";
import { PortalAccessDashboard } from "@/components/operations/clients/portal-access-dashboard";
import { requireFounder } from "@/lib/growth/auth/require-founder";
import { listFounderAccessOverview } from "@/lib/operations/auth/founder-access-repository";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";

export const dynamic = "force-dynamic";

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  const founder = await requireFounder();
  const data = await listFounderAccessOverview(
    getOperationsDb(),
    founder,
    await searchParams,
  );
  return <PortalAccessDashboard data={data} />;
}
