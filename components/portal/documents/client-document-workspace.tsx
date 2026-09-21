import { FileText, Upload } from "lucide-react";
import {
  Notice,
  PageHeader,
  PortalActionLink,
  PortalButton,
  PortalCard,
} from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import type { UploadConfiguration } from "@/lib/operations/documents/uploads";
import type { PortalWorkspaceDocument } from "@/lib/operations/workspaces/types";
import styles from "../client-workspace.module.css";

type ClientDocumentWorkspaceProps = Readonly<{
  documents: readonly PortalWorkspaceDocument[];
  organisationId: string;
  pagination?: React.ReactNode;
  quarantineNotice?: boolean;
  uploadConfiguration: UploadConfiguration;
}>;

function organisationHref(pathname: string, organisationId: string): string {
  const query = new URLSearchParams({ organisationId });
  return `${portalPath(pathname)}?${query.toString()}`;
}

function documentDescription(document: PortalWorkspaceDocument): string {
  if (document.kind === "link") return "Approved link";
  return `${document.filename} · ${Math.max(1, Math.ceil(document.sizeBytes / 1024))} KB`;
}

export function ClientDocumentWorkspace({
  documents,
  organisationId,
  pagination,
  quarantineNotice = false,
  uploadConfiguration,
}: ClientDocumentWorkspaceProps): React.JSX.Element {
  return (
    <div className={styles.page}>
      <PageHeader
        breadcrumbs={[{ href: portalPath("/portal"), label: "Your workspace" }]}
        description="Approved project files and links shared with your organisation."
        eyebrow="Your retained work"
        title="Your documents"
        action={
          <PortalButton
            disabled={!uploadConfiguration.enabled}
            disabledReason={uploadConfiguration.reason}
            type="button"
            variant="secondary"
          >
            <Upload aria-hidden="true" size={16} />
            Upload document
          </PortalButton>
        }
      />
      <Notice tone="info">
        Files only appear after FSS has cleared them for your workspace.
      </Notice>
      {quarantineNotice ? (
        <Notice tone="warning">
          Your file is being checked. The file will be available after it
          passes the security check. You can leave and return later.
        </Notice>
      ) : null}
      <section
        className={styles.group}
        aria-labelledby="shared-documents-heading"
      >
        <div className={styles.groupHeading}>
          <div>
            <h2 id="shared-documents-heading">Shared documents</h2>
            <p>Files and links retained for your agreed work.</p>
          </div>
          <span aria-label={`${documents.length} documents`}>
            {documents.length}
          </span>
        </div>
        {documents.length > 0 ? (
          <ul className={styles.cardList}>
            {documents.map((document) => (
              <li key={document.id}>
                <PortalCard className={styles.card}>
                  <div className={styles.documentHeading}>
                    <FileText aria-hidden="true" size={22} />
                    <div>
                      <h3>{document.title}</h3>
                      <p>{document.projectTitle}</p>
                    </div>
                  </div>
                  <p className={styles.summary}>
                    {documentDescription(document)}
                  </p>
                  <PortalActionLink
                    href={organisationHref(
                      `/portal/documents/${document.id}`,
                      organisationId,
                    )}
                    variant="secondary"
                  >
                    View document
                  </PortalActionLink>
                </PortalCard>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>
            There are no shared documents yet. Your FSS team will add approved
            deliverables here.
          </p>
        )}
      </section>
      {pagination}
    </div>
  );
}
