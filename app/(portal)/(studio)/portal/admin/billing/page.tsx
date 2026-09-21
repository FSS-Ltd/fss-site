import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { BillingOperations } from "@/components/portal/studio/billing-operations";
import { Notice, PageHeader } from "@/components/portal/ui";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { readBillingConfiguration } from "@/lib/operations/billing/configuration";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { listStudioBillingOperations } from "@/lib/operations/studio/operations-queues";
import { parseWorkspacePage } from "@/lib/operations/workspaces/pagination";

export const dynamic = "force-dynamic";

function billingAvailable(): boolean {
  try {
    return readBillingConfiguration().enabled;
  } catch {
    return false;
  }
}

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const params = await searchParams;
  const result = await (async () => {
    const db = getOperationsDb();
    const admin = await requireFssAdmin(db, identity, randomUUID());
    if (!billingAvailable()) return { available: false as const };
    const organisationId = Array.isArray(params.organisationId)
      ? undefined
      : params.organisationId;
    return {
      available: true as const,
      data: await listStudioBillingOperations(db, admin, {
      organisationId,
      page: parseWorkspacePage(params.page),
      }),
    };
  })().catch(() => null);
  if (!result) return <PortalUnavailable />;
  if (!result.available) {
    return (
      <main>
        <PageHeader
          description="Billing remains deployment-managed until the approved provider configuration is available."
          eyebrow="FSS Studio · Billing"
          title="Billing operations unavailable"
        />
        <Notice tone="info">
          No payment or provider operation can be started from this workspace.
        </Notice>
      </main>
    );
  }
  return <BillingOperations data={result.data} />;
}
