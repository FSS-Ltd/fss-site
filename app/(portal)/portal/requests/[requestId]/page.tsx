import Link from "next/link";
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

export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const context = await getPortalPageContext(
    (await searchParams).organisationId,
  );
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
  return (
    <div>
      <Link href={`/portal/requests?organisationId=${context.organisationId}`}>
        All requests
      </Link>
      <RequestDetail
        request={request}
        organisationId={context.organisationId}
        canComment={hasPortalCapability(membership.role, "requests.comment")}
      />
    </div>
  );
}
