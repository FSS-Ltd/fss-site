"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  permittedDeliveryTargets,
  type DeliveryStatus,
} from "@/lib/growth/pipeline/stages";

import styles from "./clients.module.css";

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  not_started: "Not started",
  discovery: "Discovery",
  build: "Build",
  review: "Review",
  complete: "Complete",
  support: "Support",
  cancelled: "Cancelled",
};

// Complete and cancelled show a confirmation panel (the newsletter-invite
// choice, or the required cancellation reason) before submitting; every
// other in-progress move is a plain one-click action.
const CONFIRM_TARGETS = new Set<DeliveryStatus>(["complete", "cancelled"]);

type Mode = { kind: "idle" } | { kind: "confirm"; target: DeliveryStatus };

type TransitionBody = {
  dimension: "delivery";
  expectedVersion: number;
  toStatus: DeliveryStatus;
  reasonCode?: string;
  includeNewsletterInvite?: boolean;
};

async function defaultPostAction(
  path: string,
  body: TransitionBody,
): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function DeliveryStatusFormFrame({
  engagementId,
  currentStatus,
  version,
  onSuccess,
  postAction = defaultPostAction,
}: {
  engagementId: string;
  currentStatus: DeliveryStatus;
  version: number;
  onSuccess: () => void;
  postAction?: (path: string, body: TransitionBody) => Promise<Response>;
}) {
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "conflict" | "error";
    message: string;
  } | null>(null);
  const [reasonCode, setReasonCode] = useState("");
  const [includeInvite, setIncludeInvite] = useState(false);

  const targets = permittedDeliveryTargets(currentStatus);

  function resetForm() {
    setMode({ kind: "idle" });
    setReasonCode("");
    setIncludeInvite(false);
  }

  async function submitMove(
    target: DeliveryStatus,
    extra: { reasonCode?: string; includeNewsletterInvite?: boolean },
  ) {
    setBusy(true);
    setFeedback(null);
    try {
      const response = await postAction(
        `/api/growth/engagements/${engagementId}/transition`,
        {
          dimension: "delivery",
          expectedVersion: version,
          toStatus: target,
          ...extra,
        },
      );

      if (response.ok) {
        resetForm();
        onSuccess();
        return;
      }

      if (response.status === 409) {
        setFeedback({
          tone: "conflict",
          message:
            "This engagement changed since you loaded it. Refresh to see the latest.",
        });
        return;
      }

      const responseBody = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      setFeedback({
        tone: "error",
        message: responseBody?.message ?? "The move could not be completed.",
      });
    } catch {
      setFeedback({
        tone: "error",
        message:
          "The move could not be completed. Check your connection and try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (targets.length === 0) {
    return null;
  }

  const cancelBlocked =
    mode.kind === "confirm" &&
    mode.target === "cancelled" &&
    reasonCode.trim().length === 0;

  return (
    <div
      aria-label={`Move ${STATUS_LABELS[currentStatus]} delivery`}
      className={styles.moveGroup}
      role="group"
    >
      {feedback && (
        <p className={styles.actionFeedback} data-tone={feedback.tone} role="alert">
          {feedback.message}
        </p>
      )}

      {mode.kind === "idle" ? (
        <div className={styles.moveButtons}>
          {targets.map((target) => (
            <button
              className={styles.moveButton}
              disabled={busy}
              key={target}
              onClick={() =>
                CONFIRM_TARGETS.has(target)
                  ? setMode({ kind: "confirm", target })
                  : submitMove(target, {})
              }
              type="button"
            >
              Move to {STATUS_LABELS[target]}
            </button>
          ))}
        </div>
      ) : (
        <form
          className={styles.moveConfirm}
          onSubmit={(event) => {
            event.preventDefault();
            if (mode.kind !== "confirm") return;
            submitMove(mode.target, {
              reasonCode: reasonCode.trim() || undefined,
              includeNewsletterInvite:
                mode.target === "complete" ? includeInvite : undefined,
            });
          }}
        >
          <p className={styles.moveConfirmTitle}>
            Move to {STATUS_LABELS[mode.target]}
          </p>

          {mode.target === "complete" && (
            <label className={styles.checkboxField}>
              <input
                checked={includeInvite}
                onChange={(event) => setIncludeInvite(event.target.checked)}
                type="checkbox"
              />
              Invite the client to join FSS Field Notes (only offered if they are
              not already subscribed)
            </label>
          )}

          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              {mode.target === "cancelled" ? "Reason (required)" : "Note (optional)"}
            </span>
            <textarea
              className={styles.textArea}
              onChange={(event) => setReasonCode(event.target.value)}
              rows={2}
              value={reasonCode}
            />
          </label>

          <div className={styles.moveConfirmActions}>
            <button
              className={styles.moveButtonSecondary}
              disabled={busy}
              onClick={resetForm}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.moveButton}
              disabled={busy || cancelBlocked}
              type="submit"
            >
              {busy ? "Moving…" : `Confirm move to ${STATUS_LABELS[mode.target]}`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function DeliveryStatusForm(props: {
  engagementId: string;
  currentStatus: DeliveryStatus;
  version: number;
}) {
  const router = useRouter();
  return (
    <DeliveryStatusFormFrame {...props} onSuccess={() => router.refresh()} />
  );
}
