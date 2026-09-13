import { notFound } from "next/navigation";
import { PortalAccessDashboard } from "@/components/operations/clients/portal-access-dashboard";
import { requireFounder } from "@/lib/growth/auth/require-founder";
import { listPortalAccess } from "@/lib/operations/auth/repository";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";

export const dynamic = "force-dynamic";

export default async function PortalAccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  const data = await listPortalAccess(getOperationsDb(), await requireFounder());
  const invite = (await searchParams).invite;
  return (
    <PortalAccessDashboard
      data={data}
      openInvitation={invite === "true"}
    />
  );
}
