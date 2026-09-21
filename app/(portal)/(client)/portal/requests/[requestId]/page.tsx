import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { requirePortalMember } from "@/lib/operations/auth/require-member";
import { hasPortalCapability } from "@/lib/operations/auth/permissions";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { getPortalRequest } from "@/lib/operations/requests/repository";
import { RequestDetail } from "@/components/portal/requests/request-detail";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { PageHeader } from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import styles from "@/components/portal/requests/requests.module.css";

export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const query = await searchParams;
  const context = await getPortalPageContext(query.organisationId);
  if (!context) return <PortalUnavailable />;
  const parsed = z.uuid().safeParse((await params).requestId);
  if (!parsed.success) notFound();
  let request, membership;
  try {
    const db = getPortalDb();
    const correlationId = randomUUID();
    membership = await requirePortalMember(
      db,
      context.identity,
      context.organisationId,
      correlationId,
    );
    request = await getPortalRequest(
      db,
      context.identity,
      context.organisationId,
      parsed.data,
      correlationId,
    );
  } catch (error) {
    if (error instanceof PortalAccessDenied) notFound();
    return <PortalUnavailable />;
  }
  if (!request) notFound();
  const requestState = Array.isArray(query.state) ? undefined : query.state;
  return (
    <div className={styles.requestPage}>
      <PageHeader
        breadcrumbs={[
          {
            label: "Requests",
            href: `${portalPath("/portal/requests")}?organisationId=${context.organisationId}`,
          },
          { label: request.title },
        ]}
        description="Follow the next step, share public feedback, and review an exact deliverable version when one is ready."
        eyebrow="FSS Studio / Requests"
        title={request.title}
      />
      <RequestDetail
        canComment={hasPortalCapability(membership.role, "requests.comment")}
        hideTitle
        initialConflict={requestState === "conflict"}
        organisationId={context.organisationId}
        request={request}
        showReviewActions={false}
      />
    </div>
  );
}
