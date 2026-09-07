import { DocumentList } from "@/components/portal/document-list";
import type { ClientDocument } from "@/lib/operations/documents/types";
import styles from "./requests.module.css";

export function RequestDocuments({
  documents,
  organisationId,
  hidePortalActions,
  headingId,
}: {
  documents: ClientDocument[];
  organisationId: string;
  hidePortalActions: boolean;
  headingId: string;
}): React.JSX.Element | null {
  if (!documents.length) return null;
  if (hidePortalActions)
    return (
      <ul className={styles.history}>
        {documents.map((document) => (
          <li key={document.id}>{document.title}</li>
        ))}
      </ul>
    );
  return (
    <DocumentList
      documents={documents}
      organisationId={organisationId}
      headingId={headingId}
    />
  );
}
