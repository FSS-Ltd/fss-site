import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { StaffDeliveryBoard } from "@/components/portal/requests/staff-delivery-board";
import { PageHeader, PortalActionLink } from "@/components/portal/ui";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import {
  listStaffDeliveryBoard,
  listStaffDeliveryClients,
} from "@/lib/operations/requests/staff-repository";
import styles from "@/components/portal/requests/requests.module.css";
import { StudioPagination } from "@/components/portal/workspace/studio-pagination";
import { parseWorkspacePage } from "@/lib/operations/workspaces/pagination";

export const dynamic = "force-dynamic";

const laneKeys = new Set([
  "all",
  "new",
  "acknowledged",
  "planned",
  "in_progress",
  "ready_for_review",
  "changes_requested",
  "done",
  "cancelled",
]);

export default async function AdminDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const params = await searchParams;
  const rawClient = Array.isArray(params.client)
    ? params.client[0]
    : params.client;
  const rawStatus = Array.isArray(params.status)
    ? params.status[0]
    : params.status;
  const moveSheet =
    !Array.isArray(params.state) && params.state === "move-sheet";
  const filters = {
    organisationId: rawClient && rawClient !== "all" ? rawClient : "all",
    status: rawStatus && laneKeys.has(rawStatus) ? rawStatus : "all",
  };
  let requests, clients;
  try {
    const page = parseWorkspacePage(params.page);
    const db = getOperationsDb();
    const admin = await requireFssAdmin(db, identity, randomUUID());
    [requests, clients] = await Promise.all([
      listStaffDeliveryBoard(db, admin, { ...filters, page }),
      listStaffDeliveryClients(db, admin),
    ]);
  } catch {
    return <PortalUnavailable />;
  }
  return (
    <div className={styles.requestPage}>
      <PageHeader
        action={
          <PortalActionLink href="/admin/delivery/new">
            Create work
          </PortalActionLink>
        }
        description="Cross-client work ordered so open delivery and overdue follow-ups stay visible. Every transition is validated on the server."
        eyebrow="FSS Studio / Delivery"
        title="Delivery board"
      />
      <StaffDeliveryBoard
        requests={requests.items}
        clients={clients}
        filters={filters}
        initialMoveRequestId={
          moveSheet
            ? requests.items.find((request) =>
                [
                  "new",
                  "acknowledged",
                  "planned",
                  "in_progress",
                  "changes_requested",
                  "done",
                ].includes(request.status),
              )?.id
            : undefined
        }
      />
      <StudioPagination
        filter={{
          client:
            filters.organisationId === "all"
              ? undefined
              : filters.organisationId,
          status: filters.status === "all" ? undefined : filters.status,
        }}
        hasNext={requests.hasNext}
        page={requests.page}
        path="/admin/delivery"
      />
    </div>
  );
}
