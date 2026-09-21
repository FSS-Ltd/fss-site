import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { CollectionPagination } from "@/components/portal/workspace/collection-pagination";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { ClientDocumentWorkspace } from "@/components/portal/documents/client-document-workspace";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { documentUploadConfiguration } from "@/lib/operations/documents/uploads";
import { parseWorkspacePage } from "@/lib/operations/workspaces/pagination";
import { listPortalWorkspaceDocuments } from "@/lib/operations/workspaces/portal-repository";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const context = await getPortalPageContext(params.organisationId);
  if (!context) return <PortalUnavailable />;
  const documents = await (async () => {
    const page = parseWorkspacePage(params.page);
    return listPortalWorkspaceDocuments(
      getPortalDb(),
      context.identity,
      context.organisationId,
      randomUUID(),
      page,
    );
  })().catch((error) => {
    if (error instanceof PortalAccessDenied) notFound();
    return null;
  });
  if (!documents) return <PortalUnavailable />;
  return (
    <ClientDocumentWorkspace
      documents={documents.items}
      organisationId={context.organisationId}
      pagination={
        <CollectionPagination
          hasNext={documents.hasNext}
          organisationId={context.organisationId}
          page={documents.page}
          path="/portal/documents"
        />
      }
      quarantineNotice={
        !Array.isArray(params.state) && params.state === "quarantine"
      }
      uploadConfiguration={documentUploadConfiguration()}
    />
  );
}
