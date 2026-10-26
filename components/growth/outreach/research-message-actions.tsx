"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { MessageReviewData } from "@/lib/growth/dashboard/message-review";
import { OutreachDialog } from "./outreach-dialog";
import { ResearchPermissionFields } from "./research-permission-fields";
import dialogStyles from "./outreach-dialog.module.css";
import { ResearchDraftEditor } from "./research-draft-editor";
import {
  draftDeliveryLabel,
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
  const sending = useRef(false);
  const [mode, setMode] = useState<"idle" | "edit" | "confirm">("idle");
  const [permission, setPermission] = useState({ basis: "", evidence: "" });
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
          <p>{draftDeliveryLabel(result)}</p>
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
          {mode !== "edit" && (
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
                aria-haspopup="dialog"
                onClick={() => {
                  setError(null);
                  setMode("confirm");
                }}
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
            <OutreachDialog
              title="Confirm and send"
              description="Approval sends this email immediately. No automatic follow-ups will be started."
              busy={pending}
              onClose={() => setMode("idle")}
            >
              <form
                className={dialogStyles.form}
                aria-label="Confirm research email send"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (
                    sending.current ||
                    blocked ||
                    !permission.basis ||
                    permission.evidence.trim().length < 10
                  )
                    return;
                  sending.current = true;
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
                          permission,
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
                    sending.current = false;
                    setPending(false);
                  }
                }}
              >
                <div className={dialogStyles.recipient}>
                  <p>
                    <strong>To:</strong> {message.contactName} &lt;
                    {message.contactEmail}&gt;
                  </p>
                  <p>
                    <strong>Subject:</strong> {message.subject}
                  </p>
                </div>
                <ResearchPermissionFields
                  value={permission}
                  onChange={setPermission}
                  disabled={pending}
                />
                {error && <p role="alert">{error}</p>}
                <div className={dialogStyles.actions}>
                  <button
                    className={styles.actionButton}
                    data-variant="primary"
                    type="submit"
                    disabled={
                      pending ||
                      blocked ||
                      !permission.basis ||
                      permission.evidence.trim().length < 10
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
            </OutreachDialog>
          )}
        </>
      )}
    </section>
  );
}
