import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CollectionPagination } from "@/components/portal/workspace/collection-pagination";
import { DocumentWorkspaceList } from "@/components/portal/workspace/document-workspace-list";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import styles from "@/components/portal/projects.module.css";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb } from "@/lib/operations/db/portal-client";
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
    <div className={styles.page}>
      <Link className={styles.breadcrumb} href={portalPath("/portal")}>
        Your workspace
      </Link>
      <p className={styles.eyebrow}>Your retained work</p>
      <h1 className={styles.title}>Documents</h1>
      <p className={styles.copy}>
        Approved project files and links shared with your organisation.
      </p>
      <section
        className={styles.section}
        aria-labelledby="shared-documents-heading"
      >
        <div className={styles.sectionHeading}>
          <h2 id="shared-documents-heading">Shared documents</h2>
          <span className={styles.note}>Cleared for your workspace</span>
        </div>
        <DocumentWorkspaceList
          documents={documents.items}
          organisationId={context.organisationId}
        />
        <CollectionPagination
          hasNext={documents.hasNext}
          organisationId={context.organisationId}
          page={documents.page}
          path="/portal/documents"
        />
      </section>
    </div>
  );
}
