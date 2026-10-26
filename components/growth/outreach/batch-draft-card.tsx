"use client";

import { canSendBatchDraft, type BatchDraftEntry } from "./batch-draft-review";
import { draftDeliveryLabel } from "./research-draft-request";
import {
  ResearchPermissionFields,
  type ResearchPermission,
} from "./research-permission-fields";
import styles from "./outreach.module.css";
import dialogStyles from "./outreach-dialog.module.css";

export function BatchDraftCard({
  entry,
  locked,
  onPermissionChange,
}: {
  entry: BatchDraftEntry;
  locked: boolean;
  onPermissionChange: (permission: ResearchPermission) => void;
}): React.JSX.Element {
  const { message, result, error } = entry;
  const ready = canSendBatchDraft(entry);
  return (
    <li className={dialogStyles.recipient}>
      <h3>{message?.businessName ?? entry.businessName}</h3>
      {message && (
        <>
          <p>
            <strong>To:</strong> {message.contactName} &lt;
            {message.contactEmail}&gt;
          </p>
          <p>
            <strong>Subject:</strong> {message.subject}
          </p>
          <p className={styles.subtitle}>
            {message.researchOnly
              ? "One email. No automatic follow-ups."
              : "Starts the Day 1, 5, 11 and 14 sequence."}
          </p>
          {!locked && (
            <details>
              <summary>Read email copy</summary>
              <p className={dialogStyles.copy}>{message.previewText}</p>
            </details>
          )}
          {!ready && (
            <p className={styles.readinessBlocked}>
              Skipped:{" "}
              {message.eligibility.reasons.join(" ") ||
                "This draft needs a new review before sending."}
            </p>
          )}
        </>
      )}
      {error && (
        <p className={styles.actionFeedback} data-tone="error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <>
          <p>{draftDeliveryLabel(result)}</p>
          {result.sequenceEnrollmentId && (
            <a
              className={styles.evidenceLink}
              href={`/growth/outreach/sequences/${result.sequenceEnrollmentId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View delivery status (new tab)
            </a>
          )}
        </>
      )}
      {!locked && (
        <>
          <a
            className={styles.evidenceLink}
            href={`/growth/outreach/messages/${entry.draftTaskId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open full review (new tab)
          </a>
          {ready && message?.researchOnly && (
            <div className={dialogStyles.form}>
              <ResearchPermissionFields
                value={entry.permission}
                onChange={onPermissionChange}
              />
            </div>
          )}
        </>
      )}
    </li>
  );
}
