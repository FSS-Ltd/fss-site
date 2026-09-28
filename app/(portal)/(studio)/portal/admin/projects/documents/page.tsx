import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import styles from "@/components/portal/studio-client.module.css";
import { StudioPagination } from "@/components/portal/workspace/studio-pagination";
import { studioDateLabel } from "@/components/portal/workspace/studio-date";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { parseWorkspacePage } from "@/lib/operations/workspaces/pagination";
import { listStaffDocuments } from "@/lib/operations/workspaces/staff-repository";
import { PortalActionLink } from "@/components/portal/ui";

export const dynamic = "force-dynamic";

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const params = await searchParams;
  const data = await (async () => {
    const db = getOperationsDb();
    const admin = await requireFssAdmin(getPortalDb(), identity, randomUUID());
    const organisationId = Array.isArray(params.organisationId)
      ? undefined
      : params.organisationId;
    const documents = await listStaffDocuments(db, admin, {
      organisationId,
      page: parseWorkspacePage(params.page),
    });
    return { documents, organisationId };
  })().catch(() => null);
  if (!data) return <PortalUnavailable />;
  const { documents, organisationId } = data;
  return (
    <section className={styles.page} aria-labelledby="studio-documents-heading">
      <Link className={styles.backLink} href="/admin/projects">
        Project workspace
      </Link>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>FSS Studio · Projects</p>
        <h1 className={styles.title} id="studio-documents-heading">
          Document register
        </h1>
        <p className={styles.description}>
          This register lists project documents already linked to delivery work.
          Agreement signing documents are prepared from each agreement&#39;s
          signing workspace.
        </p>
      </header>
      {documents.items.length === 0 ? (
        <div>
          <p className={styles.rowCopy}>
            No project documents match this workspace view.
          </p>
          <p className={styles.rowCopy}>
            Prepare agreement documents in the client&#39;s agreement workspace.
            Project documents appear here after they are attached to a project.
          </p>
          {organisationId ? (
            <PortalActionLink
              href={`/admin/clients/${encodeURIComponent(organisationId)}/signing`}
            >
              Open agreement signing documents
            </PortalActionLink>
          ) : null}
        </div>
      ) : (
        <ul className={styles.rowList}>
          {documents.items.map((document) => (
            <li className={styles.row} key={document.id}>
              <div className={styles.rowContent}>
                <h2 className={styles.rowTitle}>{document.title}</h2>
                <p className={styles.rowCopy}>
                  {document.organisationName} · {document.projectTitle} ·{" "}
                  {document.kind}
                </p>
                <p className={styles.rowCopy}>
                  {document.visibility} visibility · {document.scanStatus} scan
                  · Added {studioDateLabel(document.createdAt)}
                </p>
              </div>
              <Link
                className={styles.actionLink}
                href={`/admin/clients/${document.organisationId}`}
              >
                Client context
              </Link>
            </li>
          ))}
        </ul>
      )}
      <StudioPagination
        filter={{ organisationId }}
        hasNext={documents.hasNext}
        page={documents.page}
        path="/admin/projects/documents"
      />
    </section>
  );
}
