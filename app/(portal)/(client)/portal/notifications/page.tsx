import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { ClientNotificationInbox } from "@/components/portal/workspace/client-notification-inbox";
import { CollectionPagination } from "@/components/portal/workspace/collection-pagination";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { parseWorkspacePage } from "@/lib/operations/workspaces/pagination";
import { listPortalNotifications } from "@/lib/operations/workspaces/portal-repository";
import { parsePortalNotificationFilter } from "@/lib/operations/workspaces/types";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const context = await getPortalPageContext(params.organisationId);
  if (!context) return <PortalUnavailable />;
  const correlationId = randomUUID();
  const data = await (async () => {
    const filter = parsePortalNotificationFilter(params.filter);
    const page = parseWorkspacePage(params.page);
    const notifications = await listPortalNotifications(
      getPortalDb(),
      context.identity,
      context.organisationId,
      correlationId,
      filter,
      page,
    );
    return { filter, notifications };
  })().catch((error) => {
    if (error instanceof PortalAccessDenied) notFound();
    return null;
  });
  if (!data)
    return (
      <PortalUnavailable
        reference={correlationId}
        retryHref={`${"/portal/notifications"}?${new URLSearchParams({ organisationId: context.organisationId }).toString()}`}
      />
    );
  const { filter, notifications } = data;
  return (
    <ClientNotificationInbox
      filter={filter}
      notifications={notifications.items}
      organisationId={context.organisationId}
      pagination={
        <CollectionPagination
          filter={{ filter: filter === "all" ? undefined : filter }}
          hasNext={notifications.hasNext}
          organisationId={context.organisationId}
          page={notifications.page}
          path="/portal/notifications"
        />
      }
    />
  );
}
