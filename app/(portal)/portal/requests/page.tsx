import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { requirePortalMember } from "@/lib/operations/auth/require-member";
import { hasPortalCapability } from "@/lib/operations/auth/permissions";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { listPortalRequests } from "@/lib/operations/requests/repository";
import { RequestBoard } from "@/components/portal/requests/board";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { CollectionPagination } from "@/components/portal/workspace/collection-pagination";
import styles from "@/components/portal/projects.module.css";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { parseWorkspacePage } from "@/lib/operations/workspaces/pagination";
import {
  requestStatuses,
  type RequestStatus,
} from "@/lib/operations/requests/types";

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const context = await getPortalPageContext(params.organisationId);
  if (!context) return <PortalUnavailable />;
  let requests, membership;
  let filters: { query: string; status?: RequestStatus } = { query: "" };
  try {
    const rawStatus = Array.isArray(params.status) ? undefined : params.status;
    const status = z
      .enum(requestStatuses)
      .optional()
      .parse(rawStatus === "all" ? undefined : rawStatus);
    const query = z
      .string()
      .trim()
      .max(100)
      .parse(Array.isArray(params.query) ? "" : (params.query ?? ""));
    filters = { query, status };
    const page = parseWorkspacePage(params.page);
    const db = getPortalDb();
    const correlationId = randomUUID();
    membership = await requirePortalMember(
      db,
      context.identity,
      context.organisationId,
      correlationId,
    );
    requests = await listPortalRequests(
      db,
      context.identity,
      context.organisationId,
      correlationId,
      { page, ...filters },
    );
  } catch (error) {
    if (error instanceof PortalAccessDenied) notFound();
    return <PortalUnavailable />;
  }
  return (
    <div className={styles.page}>
      <Link className={styles.breadcrumb} href={portalPath("/portal")}>
        Your workspace
      </Link>
      <p className={styles.eyebrow}>Work, together</p>
      <h1 className={styles.title}>Requests</h1>
      <p className={styles.copy}>
        A clear place for new ideas, feedback and the next step.
      </p>
      {hasPortalCapability(membership.role, "requests.create") && (
        <Link
          className={styles.breadcrumb}
          href={`${portalPath("/portal/requests/new")}?organisationId=${context.organisationId}`}
        >
          New request
        </Link>
      )}
      <RequestBoard
        filters={filters}
        requests={requests.items}
        organisationId={context.organisationId}
      />
      <CollectionPagination
        filter={{ query: filters.query || undefined, status: filters.status }}
        hasNext={requests.hasNext}
        organisationId={context.organisationId}
        page={requests.page}
        path="/portal/requests"
      />
    </div>
  );
}
