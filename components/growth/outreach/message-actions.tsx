"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { formatGrowthCurrency } from "@/lib/growth/dashboard/formatters";
import type { MessageReviewData } from "@/lib/growth/dashboard/message-review";

import styles from "./outreach.module.css";

type ActionKey =
  | "approve-send"
  | "create-gmail-draft"
  | "edit-draft"
  | "needs-redraft"
  | "reject"
  | "do-not-contact";

type Feedback = { tone: "conflict" | "error" | "success"; message: string };

const MIN_REDRAFT_REASON_LENGTH = 10;

async function postAction(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; status: number; message?: string }> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.ok) return { ok: true };

    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    return { ok: false, status: response.status, message: payload?.message };
  } catch {
    return { ok: false, status: 0 };
  }
}

export function MessageActionsFrame({
  message,
  onSuccess,
}: {
  message: MessageReviewData;
  onSuccess: () => void;
}) {
  const formId = useId();
  const [pendingAction, setPendingAction] = useState<ActionKey | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [mode, setMode] = useState<"idle" | "edit" | "redraft" | "confirm-send">(
    "idle",
  );
  const [subjectDraft, setSubjectDraft] = useState(message.subject);
  const [bodyDraft, setBodyDraft] = useState(
    message.editableParagraphs.join("\n\n"),
  );
  const [redraftReason, setRedraftReason] = useState("");

  const busy = pendingAction !== null;

  async function run(action: ActionKey, path: string, body: Record<string, unknown>) {
    setPendingAction(action);
    setFeedback(null);

    const result = await postAction(path, body);
    setPendingAction(null);

    if (result.ok) {
      setMode("idle");
      onSuccess();
      return;
    }

    if (result.status === 409) {
      setFeedback({
        tone: "conflict",
        message:
          result.message ??
          "This draft changed since you loaded it. Refresh to see the latest.",
      });
      return;
    }

    setFeedback({
      tone: "error",
      message: result.message ?? "The action could not be completed.",
    });
  }

  return (
    <div className={styles.card}>
      <div className={styles.readiness}>
        {message.eligibility.ready ? (
          <p className={styles.readinessReady}>Ready for founder review.</p>
        ) : (
          <>
            <p className={styles.readinessBlocked}>
              Sending is blocked until these are resolved:
            </p>
            <ul className={styles.readinessReasons}>
              {message.eligibility.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div aria-label="First-email decision" className={styles.actionsBar} role="group">
        {feedback && (
          <p className={styles.actionFeedback} data-tone={feedback.tone} role="alert">
            {feedback.message}
          </p>
        )}

        <button
          className={styles.actionButton}
          disabled={busy}
          onClick={() => setMode(mode === "edit" ? "idle" : "edit")}
          type="button"
        >
          Edit draft
        </button>

        <button
          className={styles.actionButton}
          data-variant="warning"
          disabled={busy}
          onClick={() => setMode(mode === "redraft" ? "idle" : "redraft")}
          type="button"
        >
          Mark needs redraft
        </button>

        <button
          className={styles.actionButton}
          disabled={busy || !message.eligibility.ready}
          onClick={() =>
            run(
              "create-gmail-draft",
              `/api/growth/messages/${message.draftTaskId}/create-gmail-draft`,
              { expectedVersion: message.version },
            )
          }
          type="button"
        >
          {pendingAction === "create-gmail-draft" ? "Creating…" : "Create Gmail draft"}
        </button>

        <button
          className={styles.actionButton}
          data-variant="primary"
          disabled={busy || !message.eligibility.ready}
          onClick={() => setMode("confirm-send")}
          type="button"
        >
          Approve &amp; send
        </button>

        <p className={styles.actionHelp}>
          Sending starts the approved Day 1, 5, 11 and 20 sequence.
        </p>

        <button
          className={styles.actionButton}
          data-variant="danger"
          disabled={busy}
          onClick={() =>
            run("reject", `/api/growth/prospects/${message.prospectId}/reject`, {
              expectedVersion: message.prospectVersion,
            })
          }
          type="button"
        >
          {pendingAction === "reject" ? "Rejecting…" : "Reject"}
        </button>

        <button
          className={styles.actionButton}
          data-variant="danger"
          disabled={busy}
          onClick={() =>
            run(
              "do-not-contact",
              `/api/growth/prospects/${message.prospectId}/do-not-contact`,
              { expectedVersion: message.prospectVersion },
            )
          }
          type="button"
        >
          {pendingAction === "do-not-contact" ? "Suppressing…" : "Do not contact"}
        </button>
      </div>

      {mode === "edit" && (
        <form
          className={styles.inlineForm}
          onSubmit={(event) => {
            event.preventDefault();
            run(
              "edit-draft",
              `/api/growth/messages/${message.draftTaskId}/edit-draft`,
              {
                expectedVersion: message.version,
                subject: subjectDraft,
                paragraphs: bodyDraft
                  .split(/\n{2,}/)
                  .map((p) => p.trim())
                  .filter(Boolean),
              },
            );
          }}
        >
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={`${formId}-subject`}>
              Subject
            </label>
            <input
              className={styles.textInput}
              id={`${formId}-subject`}
              onChange={(event) => setSubjectDraft(event.target.value)}
              type="text"
              value={subjectDraft}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={`${formId}-body`}>
              Copy (blank line between paragraphs)
            </label>
            <textarea
              className={styles.textArea}
              id={`${formId}-body`}
              onChange={(event) => setBodyDraft(event.target.value)}
              rows={10}
              value={bodyDraft}
            />
          </div>
          <div className={styles.formActions}>
            <button
              className={styles.actionButton}
              data-variant="primary"
              disabled={busy}
              type="submit"
            >
              {pendingAction === "edit-draft" ? "Saving…" : "Save revision"}
            </button>
            <button
              className={styles.actionButton}
              onClick={() => setMode("idle")}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {mode === "redraft" && (
        <form
          className={styles.inlineForm}
          onSubmit={(event) => {
            event.preventDefault();
            run(
              "needs-redraft",
              `/api/growth/messages/${message.draftTaskId}/needs-redraft`,
              { expectedVersion: message.version, reason: redraftReason },
            );
          }}
        >
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={`${formId}-reason`}>
              Reason for redraft (at least {MIN_REDRAFT_REASON_LENGTH} characters)
            </label>
            <textarea
              className={styles.textArea}
              id={`${formId}-reason`}
              onChange={(event) => setRedraftReason(event.target.value)}
              rows={4}
              value={redraftReason}
            />
          </div>
          <div className={styles.formActions}>
            <button
              className={styles.actionButton}
              data-variant="warning"
              disabled={busy || redraftReason.trim().length < MIN_REDRAFT_REASON_LENGTH}
              type="submit"
            >
              {pendingAction === "needs-redraft" ? "Sending back…" : "Send back for redraft"}
            </button>
            <button
              className={styles.actionButton}
              onClick={() => setMode("idle")}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {mode === "confirm-send" && (
        <div className={styles.dialogBackdrop} role="presentation">
          <div
            aria-labelledby={`${formId}-confirm-title`}
            className={styles.dialog}
            role="alertdialog"
          >
            <h2 className={styles.dialogTitle} id={`${formId}-confirm-title`}>
              Confirm and send
            </h2>
            <p>This starts the Day 1, 5, 11 and 20 sequence for:</p>
            <dl className={styles.dialogSummary}>
              <div>
                <strong>To:</strong> {message.contactName} &lt;{message.contactEmail}
                &gt;
              </div>
              <div>
                <strong>Subject:</strong> {message.subject}
              </div>
              <div>
                <strong>Visual:</strong>{" "}
                {message.visualKind === "stored" ? "Approved image attached" : "Fallback visual attached"}
              </div>
              <div>
                <strong>Potential value:</strong>{" "}
                {formatGrowthCurrency(message.estimatedOneOffMinPence)}–
                {formatGrowthCurrency(message.estimatedOneOffMaxPence)}
              </div>
            </dl>
            <div className={styles.dialogActions}>
              <button
                className={styles.actionButton}
                onClick={() => setMode("idle")}
                type="button"
              >
                Cancel
              </button>
              <button
                className={styles.actionButton}
                data-variant="primary"
                disabled={busy}
                onClick={() =>
                  run(
                    "approve-send",
                    `/api/growth/messages/${message.draftTaskId}/approve-send`,
                    { expectedVersion: message.version },
                  )
                }
                type="button"
              >
                {pendingAction === "approve-send" ? "Sending…" : "Approve & send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MessageActions({ message }: { message: MessageReviewData }) {
  const router = useRouter();
  return (
    <MessageActionsFrame message={message} onSuccess={() => router.refresh()} />
  );
}
