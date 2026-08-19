"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { OutreachSequenceDetail } from "@/lib/growth/dashboard/outreach";

import styles from "./outreach.module.css";

const TERMINAL_STATUSES = new Set([
  "stopped_reply",
  "stopped_opt_out",
  "stopped_bounce",
  "stopped_rejected",
  "stopped_started_talks",
  "completed",
]);

type ActionKey = "pause" | "resume" | "started-talks" | "reject" | "do-not-contact";

type Feedback = { tone: "conflict" | "error"; message: string };

async function postAction(
  path: string,
): Promise<{ ok: true } | { ok: false; status: number; message?: string }> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
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

export function SequenceControlsFrame({
  detail,
  onSuccess,
}: {
  detail: OutreachSequenceDetail;
  onSuccess: () => void;
}) {
  const [pendingAction, setPendingAction] = useState<ActionKey | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const busy = pendingAction !== null;
  const isTerminal = TERMINAL_STATUSES.has(detail.status);

  async function run(action: ActionKey, path: string) {
    setPendingAction(action);
    setFeedback(null);
    const result = await postAction(path);
    setPendingAction(null);

    if (result.ok) {
      onSuccess();
      return;
    }
    if (result.status === 409) {
      setFeedback({
        tone: "conflict",
        message:
          result.message ??
          "This sequence changed since you loaded it. Refresh to see the latest.",
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
      <div>
        <h2 className={styles.sectionTitle}>Conversation controls</h2>
        <p className={styles.timelineMeta}>These actions stop the sequence.</p>
      </div>

      <div
        aria-label="Sequence controls"
        className={styles.actionsBar}
        role="group"
      >
        {feedback && (
          <p className={styles.actionFeedback} data-tone={feedback.tone} role="alert">
            {feedback.message}
          </p>
        )}

        {detail.resumable ? (
          <button
            className={styles.actionButton}
            data-variant="primary"
            disabled={busy}
            onClick={() =>
              run("resume", `/api/growth/sequences/${detail.sequenceId}/resume`)
            }
            type="button"
          >
            {pendingAction === "resume" ? "Resuming…" : "Resume"}
          </button>
        ) : (
          <button
            className={styles.actionButton}
            disabled={busy || isTerminal || detail.status !== "active"}
            onClick={() =>
              run("pause", `/api/growth/sequences/${detail.sequenceId}/pause`)
            }
            type="button"
          >
            {pendingAction === "pause" ? "Pausing…" : "Pause"}
          </button>
        )}

        <button
          className={styles.actionButton}
          data-variant="primary"
          disabled={busy || isTerminal}
          onClick={() =>
            run(
              "started-talks",
              `/api/growth/sequences/${detail.sequenceId}/started-talks`,
            )
          }
          type="button"
        >
          {pendingAction === "started-talks" ? "Saving…" : "Started talks"}
        </button>

        <button
          className={styles.actionButton}
          disabled={busy || isTerminal}
          onClick={() =>
            run("reject", `/api/growth/sequences/${detail.sequenceId}/reject`)
          }
          type="button"
        >
          {pendingAction === "reject" ? "Rejecting…" : "Reject"}
        </button>

        <button
          className={styles.actionButton}
          data-variant="danger"
          disabled={busy || isTerminal}
          onClick={() =>
            run(
              "do-not-contact",
              `/api/growth/sequences/${detail.sequenceId}/do-not-contact`,
            )
          }
          type="button"
        >
          {pendingAction === "do-not-contact" ? "Suppressing…" : "Do not contact"}
        </button>
      </div>
    </div>
  );
}

export function SequenceControls({ detail }: { detail: OutreachSequenceDetail }) {
  const router = useRouter();
  return (
    <SequenceControlsFrame detail={detail} onSuccess={() => router.refresh()} />
  );
}
