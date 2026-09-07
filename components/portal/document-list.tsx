import { Download, ExternalLink, FileText } from "lucide-react";
import type { ClientDocument } from "@/lib/operations/documents/types";
import styles from "./projects.module.css";
export function DocumentList({
  documents,
  organisationId,
}: {
  documents: ClientDocument[];
  organisationId: string;
}): React.JSX.Element {
  return (
    <section aria-labelledby="documents-heading" className={styles.section}>
      <div className={styles.sectionHeading}>
        <h2 id="documents-heading">Documents</h2>
        <span className={styles.note}>Shared with you</span>
      </div>
      {documents.length === 0 ? (
        <p className={styles.empty}>
          There are no shared documents yet. Your FSS team will add approved
          deliverables here.
        </p>
      ) : (
        <ul className={styles.documents}>
          {documents.map((document) => (
            <li key={document.id}>
              <FileText
                size={22}
                aria-hidden="true"
                className={styles.fileIcon}
              />
              <div className={styles.documentTitle}>
                <h3>{document.title}</h3>
                <p className={styles.note}>
                  {document.kind === "file"
                    ? `${document.filename} · ${Math.max(1, Math.ceil(document.sizeBytes / 1024))} KB`
                    : "Approved deliverable"}
                </p>
              </div>
              <a
                className={styles.documentAction}
                href={
                  document.kind === "link"
                    ? document.url
                    : `/api/portal/organisations/${encodeURIComponent(organisationId)}/documents/${encodeURIComponent(document.id)}/download`
                }
                {...(document.kind === "link"
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                aria-label={`${document.kind === "link" ? "Open" : "Download"} ${document.title}${document.kind === "link" ? " (opens in a new tab)" : ""}`}
              >
                {document.kind === "link" ? (
                  <ExternalLink size={17} aria-hidden="true" />
                ) : (
                  <Download size={17} aria-hidden="true" />
                )}
                <span>{document.kind === "link" ? "Open" : "Download"}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.note}>
        To share a file, contact your FSS team for the agreed secure transfer
        method.
      </p>
    </section>
  );
}
