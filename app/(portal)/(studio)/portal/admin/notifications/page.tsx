import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { NotificationDelivery } from "@/components/portal/studio/notification-delivery";
import { Notice, PageHeader } from "@/components/portal/ui";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { listStudioNotifications } from "@/lib/operations/studio/operations-queues";
import { parseWorkspacePage } from "@/lib/operations/workspaces/pagination";

export const dynamic = "force-dynamic";

const statusSchema = z.enum([
  "all",
  "pending",
  "retry",
  "succeeded",
  "held",
  "needs_attention",
]);

export default async function AdminNotificationsPage({
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
    const admin = await requireFssAdmin(getPortalDb(), identity, randomUUID());
    if (process.env.OPERATIONS_REQUEST_EMAILS_ENABLED !== "true")
      return { available: false as const };
    const rawStatus = Array.isArray(params.status)
      ? "all"
      : (params.status ?? "all");
    const selectedStatus = statusSchema.parse(rawStatus);
    return {
      available: true as const,
      data: await listStudioNotifications(db, admin, {
        page: parseWorkspacePage(params.page),
        status: selectedStatus,
      }),
      selectedStatus,
    };
  })().catch(() => null);
  if (!result) return <PortalUnavailable />;
  if (!result.available) {
    return (
      <main>
        <PageHeader
          description="Provider-backed request email delivery is not enabled for this workspace. In-app request updates remain available to each client."
          eyebrow="FSS Studio · Notifications"
          title="Notification delivery unavailable"
        />
        <Notice tone="info">
          This page cannot enable email delivery or replay any client journey.
        </Notice>
      </main>
    );
  }
  return (
    <NotificationDelivery
      data={result.data}
      selectedStatus={result.selectedStatus}
    />
  );
}
