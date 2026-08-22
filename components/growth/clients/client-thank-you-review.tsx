"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatGrowthStatusLabel } from "@/lib/growth/dashboard/formatters";
import type { ClientThankYouReviewData } from "@/lib/growth/dashboard/clients";

import styles from "./clients.module.css";

type PreviewMode = "html" | "text";

type ApproveSendBody = {
  expectedVersion: number;
  includeNewsletterInvite: boolean;
};

async function defaultPostAction(
  path: string,
  body: object,
): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function ClientThankYouReviewFrame({
  review,
  onSuccess,
  postAction = defaultPostAction,
}: {
  review: ClientThankYouReviewData;
  onSuccess: () => void;
  postAction?: (path: string, body: object) => Promise<Response>;
}) {
  const [mode, setMode] = useState<PreviewMode>("html");
  const [includeInvite, setIncludeInvite] = useState(review.includedNewsletterInvite);
  const [busy, setBusy] = useState<"test" | "send" | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "conflict" | "error";
    message: string;
  } | null>(null);

  const alreadySent = review.status === "sent";

  async function sendTest() {
    setBusy("test");
    setFeedback(null);
    try {
      const response = await postAction(
        `/api/growth/client-messages/${review.messageId}/send-test`,
        {},
      );
      if (response.ok) {
        setFeedback({
          tone: "success",
          message: `Test sent to ${review.founderEmail}.`,
        });
        onSuccess();
        return;
      }
      const body = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      setFeedback({
        tone: "error",
        message: body?.message ?? "The test could not be sent.",
      });
    } catch {
      setFeedback({
        tone: "error",
        message: "The test could not be sent. Check your connection and try again.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function approveAndSend() {
    setBusy("send");
    setFeedback(null);
    try {
      const body: ApproveSendBody = {
        expectedVersion: review.version,
        includeNewsletterInvite: includeInvite,
      };
      const response = await postAction(
        `/api/growth/client-messages/${review.messageId}/approve-send`,
        body,
      );
      if (response.ok) {
        setFeedback({ tone: "success", message: "Sent to the client." });
        onSuccess();
        return;
      }
      if (response.status === 409) {
        setFeedback({
          tone: "conflict",
          message:
            "This message changed since you loaded it. Refresh to see the latest.",
        });
        return;
      }
      const responseBody = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      setFeedback({
        tone: "error",
        message: responseBody?.message ?? "The message could not be sent.",
      });
    } catch {
      setFeedback({
        tone: "error",
        message:
          "The message could not be sent. Check your connection and try again.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>Client thank-you</h2>

      <div className={styles.envelope}>
        <div className={styles.envelopeRow}>
          <span className={styles.envelopeLabel}>To</span>
          <span className={styles.envelopeValue}>
            {review.recipientName} &lt;{review.recipientEmail}&gt;
          </span>
        </div>
        <div className={styles.envelopeRow}>
          <span className={styles.envelopeLabel}>Subject</span>
          <span className={styles.envelopeValue}>{review.subject}</span>
        </div>
        <div className={styles.envelopeRow}>
          <span className={styles.envelopeLabel}>Status</span>
          <span className={styles.envelopeValue}>
            {formatGrowthStatusLabel(review.status)}
          </span>
        </div>
      </div>

      <div
        aria-label="Preview format"
        className={styles.previewToggle}
        role="group"
      >
        <button
          aria-pressed={mode === "html"}
          className={styles.previewToggleButton}
          onClick={() => setMode("html")}
          type="button"
        >
          HTML
        </button>
        <button
          aria-pressed={mode === "text"}
          className={styles.previewToggleButton}
          onClick={() => setMode("text")}
          type="button"
        >
          Plain text
        </button>
      </div>

      {mode === "html" ? (
        <div className={styles.previewFrame}>
          <iframe
            sandbox=""
            srcDoc={review.previewHtml}
            title="Client thank-you HTML preview"
          />
        </div>
      ) : (
        <pre className={styles.previewPlainText}>{review.previewText}</pre>
      )}

      {alreadySent ? (
        <p className={styles.inlineEmpty}>This message has already been sent.</p>
      ) : (
        <>
          {review.includedNewsletterInvite ? (
            <label className={`${styles.checkboxField} ${styles.inviteToggle}`}>
              <input
                checked={includeInvite}
                onChange={(event) => setIncludeInvite(event.target.checked)}
                type="checkbox"
              />
              Include the FSS Field Notes invitation
            </label>
          ) : (
            <p className={`${styles.inlineEmpty} ${styles.inviteToggle}`}>
              This client is already subscribed, so the newsletter invitation was
              not offered.
            </p>
          )}

          {feedback && (
            <p className={styles.actionFeedback} data-tone={feedback.tone} role="alert">
              {feedback.message}
            </p>
          )}

          <div className={styles.actionsBar}>
            <button
              className={styles.actionButton}
              disabled={busy !== null}
              onClick={sendTest}
              type="button"
            >
              {busy === "test" ? "Sending…" : `Send test to ${review.founderEmail}`}
            </button>
            <button
              className={styles.actionButton}
              data-variant="primary"
              disabled={busy !== null}
              onClick={approveAndSend}
              type="button"
            >
              {busy === "send" ? "Sending…" : "Approve and send"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function ClientThankYouReview({
  review,
}: {
  review: ClientThankYouReviewData;
}) {
  const router = useRouter();
  return (
    <ClientThankYouReviewFrame onSuccess={() => router.refresh()} review={review} />
  );
}
