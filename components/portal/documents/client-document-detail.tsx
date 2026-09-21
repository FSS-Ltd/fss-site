import { Download, ExternalLink, FileText } from "lucide-react";
import {
  Notice,
  PageHeader,
  PortalActionLink,
  PortalCard,
} from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import type { ClientDocumentDetail as ClientDocumentDetailData } from "@/lib/operations/documents/types";
import styles from "../client-workspace.module.css";

type ClientDocumentDetailProps = Readonly<{
  document: ClientDocumentDetailData;
  organisationId: string;
}>;

function organisationHref(pathname: string, organisationId: string): string {
  const query = new URLSearchParams({ organisationId });
  return `${portalPath(pathname)}?${query.toString()}`;
}

function formatPublicationDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function fileDownloadHref(organisationId: string, documentId: string): string {
  return `/api/portal/organisations/${encodeURIComponent(organisationId)}/documents/${encodeURIComponent(documentId)}/download`;
}

export function ClientDocumentDetail({
  document,
  organisationId,
}: ClientDocumentDetailProps): React.JSX.Element {
  const isLink = document.kind === "link";
  const fileDescription =
    document.kind === "file"
      ? `${document.filename} · ${Math.max(1, Math.ceil(document.sizeBytes / 1024))} KB`
      : "Approved external link";
  const actionHref = isLink
    ? document.url
    : fileDownloadHref(organisationId, document.id);

  return (
    <div className={styles.page}>
      <PageHeader
        breadcrumbs={[
          {
            href: organisationHref("/portal/documents", organisationId),
            label: "Documents",
          },
          { label: document.title },
        ]}
        description={`Shared with the ${document.projectTitle} project team.`}
        eyebrow="Shared document"
        title={document.title}
      />
      <PortalCard title="File information">
        <div className={styles.documentHeading}>
          <FileText aria-hidden="true" size={24} />
          <div>
            <h3>{document.title}</h3>
            <p>{fileDescription}</p>
          </div>
        </div>
        <dl className={styles.metadata}>
          <div>
            <dt>Project</dt>
            <dd>{document.projectTitle}</dd>
          </div>
          <div>
            <dt>Current version</dt>
            <dd>Version {document.version}</dd>
          </div>
          <div>
            <dt>Published</dt>
            <dd>{formatPublicationDate(document.createdAt)}</dd>
          </div>
          <div>
            <dt>Access</dt>
            <dd>Shared with your project team</dd>
          </div>
        </dl>
        <PortalActionLink
          href={actionHref}
          {...(isLink ? { rel: "noopener noreferrer", target: "_blank" } : {})}
        >
          {isLink ? (
            <ExternalLink aria-hidden="true" size={16} />
          ) : (
            <Download aria-hidden="true" size={16} />
          )}
          {isLink ? "Open approved link" : "Download file"}
        </PortalActionLink>
      </PortalCard>
      <Notice tone="info">
        {isLink
          ? "This approved link opens in a new tab."
          : "A browser preview is not available for this file. Download it through the authenticated link above."}
      </Notice>
      <PortalActionLink
        href={organisationHref(
          `/portal/projects/${document.projectId}`,
          organisationId,
        )}
        variant="secondary"
      >
        View project
      </PortalActionLink>
    </div>
  );
}
