import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { ClientDocumentDetail } from "@/components/portal/documents/client-document-detail";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { getPortalDocumentDetail } from "@/lib/operations/documents/repository";

export const dynamic = "force-dynamic";

export default async function DocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const [routeParameters, query] = await Promise.all([params, searchParams]);
  const documentId = z.uuid().safeParse(routeParameters.documentId);
  if (!documentId.success) notFound();

  const context = await getPortalPageContext(query.organisationId);
  if (!context) return <PortalUnavailable />;

  let document;
  try {
    document = await getPortalDocumentDetail(
      getPortalDb(),
      context.identity,
      context.organisationId,
      documentId.data,
      randomUUID(),
    );
  } catch (error) {
    if (error instanceof PortalAccessDenied) notFound();
    return <PortalUnavailable />;
  }
  if (!document) notFound();

  return (
    <ClientDocumentDetail
      document={document}
      organisationId={context.organisationId}
    />
  );
}
