import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { RequestDetail } from "@/components/portal/requests/request-detail";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { PageHeader } from "@/components/portal/ui";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { hasPortalCapability } from "@/lib/operations/auth/permissions";
import { requirePortalMember } from "@/lib/operations/auth/require-member";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { getPortalRequest } from "@/lib/operations/requests/repository";
import styles from "@/components/portal/requests/requests.module.css";

const reviewDecisionSchema = z.enum(["accept", "request_changes"]);

export default async function RequestReviewPage({
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
  if (request.status !== "ready_for_review") {
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
          description="This request is not waiting for a review decision. Its current record remains available below."
          eyebrow="FSS Studio / Requests"
          title="Review unavailable"
        />
        <RequestDetail
          canComment={hasPortalCapability(membership.role, "requests.comment")}
          hideTitle
          organisationId={context.organisationId}
          request={request}
          showReviewActions={false}
        />
      </div>
    );
  }
  const rawDecision = Array.isArray(query.decision)
    ? undefined
    : query.decision;
  const initialDecision = reviewDecisionSchema.safeParse(
    rawDecision === "changes" ? "request_changes" : rawDecision,
  ).data;
  return (
    <div className={styles.requestPage}>
      <PageHeader
        breadcrumbs={[
          {
            label: "Requests",
            href: `${portalPath("/portal/requests")}?organisationId=${context.organisationId}`,
          },
          {
            label: request.title,
            href: `${portalPath(`/portal/requests/${request.id}`)}?organisationId=${context.organisationId}`,
          },
          { label: "Review" },
        ]}
        description="Review this exact deliverable version before accepting it or asking FSS for changes."
        eyebrow="FSS Studio / Requests"
        title="Ready for your review"
      />
      <RequestDetail
        canComment={hasPortalCapability(membership.role, "requests.comment")}
        hideTitle
        initialReviewDecision={initialDecision}
        organisationId={context.organisationId}
        request={request}
      />
    </div>
  );
}
