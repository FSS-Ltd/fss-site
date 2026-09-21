import { Download, ExternalLink, FileText } from "lucide-react";
import { PortalActionLink } from "@/components/portal/ui";
import type { PortalWorkspaceDocument } from "@/lib/operations/workspaces/types";
import styles from "./workspace.module.css";

export function DocumentWorkspaceList({
  documents,
  organisationId,
}: {
  documents: readonly PortalWorkspaceDocument[];
  organisationId: string;
}): React.JSX.Element {
  if (documents.length === 0)
    return (
      <p className={styles.empty}>
        There are no shared documents yet. Files appear here only after FSS has
        cleared them for your workspace.
      </p>
    );

  return (
    <ul className={styles.collection} aria-label="Shared documents">
      {documents.map((document) => (
        <li className={styles.row} key={document.id}>
          <FileText aria-hidden="true" className={styles.icon} size={22} />
          <div className={styles.rowContent}>
            <h2>{document.title}</h2>
            <p>
              {document.projectTitle} ·{" "}
              {document.kind === "file"
                ? `${document.filename} · ${Math.max(1, Math.ceil(document.sizeBytes / 1024))} KB`
                : "Approved link"}
            </p>
          </div>
          <PortalActionLink
            className={styles.rowAction}
            href={
              document.kind === "link"
                ? document.url
                : `/api/portal/organisations/${encodeURIComponent(organisationId)}/documents/${encodeURIComponent(document.id)}/download`
            }
            {...(document.kind === "link"
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            aria-label={`${document.kind === "link" ? "Open" : "Download"} ${document.title}${document.kind === "link" ? " in a new tab" : ""}`}
            variant="secondary"
          >
            {document.kind === "link" ? (
              <ExternalLink aria-hidden="true" size={17} />
            ) : (
              <Download aria-hidden="true" size={17} />
            )}
            {document.kind === "link" ? "Open" : "Download"}
          </PortalActionLink>
        </li>
      ))}
    </ul>
  );
}
