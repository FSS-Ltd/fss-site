"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { MessageReviewData } from "@/lib/growth/dashboard/message-review";
import { ResearchDraftEditor } from "./research-draft-editor";
import {
  postResearchDraftAction,
  type ResearchDraftResponse,
} from "./research-draft-request";
import styles from "./outreach.module.css";

export function ResearchMessageActions({
  message,
  onSaved = () => window.location.reload(),
}: {
  message: MessageReviewData;
  onSaved?: () => void;
}) {
  const id = useId();
  const [mode, setMode] = useState<"idle" | "edit" | "confirm">("idle");
  const [basis, setBasis] = useState("");
  const [evidence, setEvidence] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchDraftResponse | null>(null);
  const blocked = !message.eligibility.ready || !message.approvalFingerprint;

  return (
    <section className={styles.card} aria-label="Research email decision">
      <h2 className={styles.sectionTitle}>Review and approve</h2>
      <p className={styles.actionHelp}>
        Approval sends this email immediately. No automatic follow-ups will be
        started.
      </p>
      {!message.eligibility.ready && (
        <ul>
          {message.eligibility.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      {result ? (
        <div
          role={
            result.status === "failed" || result.status === "cancelled"
              ? "alert"
              : "status"
          }
        >
          <p>
            {result.status === "sent"
              ? "Email sent."
              : result.status === "failed"
                ? "Delivery failed. Open delivery status for details."
                : result.status === "cancelled"
                  ? "Sending was cancelled because the recipient or permission changed."
                  : "Approval saved. Delivery has not yet been confirmed."}
          </p>
          {result.sequenceEnrollmentId && (
            <Link
              className={styles.rowLink}
              href={`/growth/outreach/sequences/${result.sequenceEnrollmentId}`}
            >
              View delivery status
            </Link>
          )}
        </div>
      ) : (
        <>
          {mode === "idle" && (
            <div className={styles.actionsBar}>
              <button
                className={styles.actionButton}
                type="button"
                onClick={() => setMode("edit")}
              >
                Edit draft
              </button>
              <button
                className={styles.actionButton}
                data-variant="primary"
                type="button"
                disabled={blocked}
                onClick={() => setMode("confirm")}
              >
                Approve &amp; send
              </button>
            </div>
          )}
          {mode === "edit" && (
            <ResearchDraftEditor
              message={message}
              onCancel={() => setMode("idle")}
              onSaved={onSaved}
            />
          )}
          {mode === "confirm" && (
            <form
              className={styles.inlineForm}
              aria-label="Confirm research email send"
              onSubmit={async (event) => {
                event.preventDefault();
                setPending(true);
                setError(null);
                try {
                  setResult(
                    await postResearchDraftAction(
                      `/api/growth/messages/${message.draftTaskId}/approve-research-send`,
                      {
                        expectedVersion: message.version,
                        expectedProspectVersion: message.prospectVersion,
                        fingerprint: message.approvalFingerprint,
                        permission: { basis, evidence },
                      },
                    ),
                  );
                } catch (failure) {
                  setError(
                    failure instanceof Error
                      ? failure.message
                      : "Delivery was not confirmed. Reload before retrying.",
                  );
                } finally {
                  setPending(false);
                }
              }}
            >
              <h3 className={styles.sectionTitle}>Confirm and send</h3>
              <p>
                To: {message.contactName} &lt;{message.contactEmail}&gt;
              </p>
              <p>Subject: {message.subject}</p>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor={`${id}-basis`}>
                  Permission to contact this recipient
                </label>
                <select
                  className={styles.textInput}
                  id={`${id}-basis`}
                  value={basis}
                  onChange={(event) => setBasis(event.target.value)}
                  required
                  disabled={pending}
                >
                  <option value="">Choose a verified basis</option>
                  <option value="corporate_legitimate_interests">
                    Verified corporate contact, legitimate interests
                  </option>
                  <option value="consent">
                    Recipient consent to this email
                  </option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor={`${id}-evidence`}>
                  Review note or permission evidence
                </label>
                <textarea
                  className={styles.textArea}
                  id={`${id}-evidence`}
                  value={evidence}
                  onChange={(event) => setEvidence(event.target.value)}
                  minLength={10}
                  maxLength={2000}
                  required
                  disabled={pending}
                  rows={3}
                />
              </div>
              {error && <p role="alert">{error}</p>}
              <div className={styles.formActions}>
                <button
                  className={styles.actionButton}
                  data-variant="primary"
                  type="submit"
                  disabled={
                    pending || blocked || !basis || evidence.trim().length < 10
                  }
                >
                  {pending ? "Sending…" : "Confirm & send now"}
                </button>
                <button
                  className={styles.actionButton}
                  type="button"
                  disabled={pending}
                  onClick={() => setMode("idle")}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
