"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  permittedCommercialTargets,
  type CommercialStage,
} from "@/lib/growth/pipeline/stages";

import styles from "./pipeline.module.css";

const STAGE_LABELS: Record<CommercialStage, string> = {
  new: "New",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

// Proposal, negotiation, won, and lost show a confirmation panel with the
// relevant fields (value, reason) before submitting; moving to qualified is
// a plain one-click action with no extra state to capture.
const CONFIRM_TARGETS = new Set<CommercialStage>([
  "proposal",
  "negotiation",
  "won",
  "lost",
]);

type Mode = { kind: "idle" } | { kind: "confirm"; target: CommercialStage };

type TransitionBody = {
  dimension: "commercial";
  expectedVersion: number;
  toStage: CommercialStage;
  reasonCode?: string;
  oneOffValuePence?: number;
  monthlyValuePence?: number;
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

function poundsToPence(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const pounds = Number(trimmed);
  if (!Number.isFinite(pounds) || pounds < 0) return undefined;
  return Math.round(pounds * 100);
}

export function StageTransitionFormFrame({
  engagementId,
  currentStage,
  version,
  onSuccess,
  postAction = defaultPostAction,
}: {
  engagementId: string;
  currentStage: CommercialStage;
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
  const [oneOffPounds, setOneOffPounds] = useState("");
  const [monthlyPounds, setMonthlyPounds] = useState("");

  const targets = permittedCommercialTargets(currentStage);

  function resetForm() {
    setMode({ kind: "idle" });
    setReasonCode("");
    setOneOffPounds("");
    setMonthlyPounds("");
  }

  async function submitMove(
    target: CommercialStage,
    extra: {
      reasonCode?: string;
      oneOffValuePence?: number;
      monthlyValuePence?: number;
    },
  ) {
    setBusy(true);
    setFeedback(null);
    try {
      const response = await postAction(
        `/api/growth/engagements/${engagementId}/transition`,
        {
          dimension: "commercial",
          expectedVersion: version,
          toStage: target,
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
            "This opportunity changed since you loaded it. Refresh to see the latest.",
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

  const oneOffValuePence = poundsToPence(oneOffPounds);
  const monthlyValuePence = poundsToPence(monthlyPounds);
  const hasValue = (oneOffValuePence ?? 0) + (monthlyValuePence ?? 0) > 0;
  const wonBlocked =
    mode.kind === "confirm" && mode.target === "won" && !hasValue;
  const lostBlocked =
    mode.kind === "confirm" &&
    mode.target === "lost" &&
    reasonCode.trim().length === 0;

  return (
    <div
      aria-label={`Move ${STAGE_LABELS[currentStage]} opportunity`}
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
              Move to {STAGE_LABELS[target]}
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
              oneOffValuePence,
              monthlyValuePence,
            });
          }}
        >
          <p className={styles.moveConfirmTitle}>
            Move to {STAGE_LABELS[mode.target]}
          </p>

          {mode.target !== "lost" && (
            <div className={styles.moveValueFields}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>One-off value (£)</span>
                <input
                  className={styles.textInput}
                  min="0"
                  onChange={(event) => setOneOffPounds(event.target.value)}
                  step="0.01"
                  type="number"
                  value={oneOffPounds}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Monthly value (£)</span>
                <input
                  className={styles.textInput}
                  min="0"
                  onChange={(event) => setMonthlyPounds(event.target.value)}
                  step="0.01"
                  type="number"
                  value={monthlyPounds}
                />
              </label>
            </div>
          )}

          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              {mode.target === "lost" ? "Reason (required)" : "Note (optional)"}
            </span>
            <textarea
              className={styles.textInput}
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
              disabled={busy || wonBlocked || lostBlocked}
              type="submit"
            >
              {busy ? "Moving…" : `Confirm move to ${STAGE_LABELS[mode.target]}`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function StageTransitionForm(props: {
  engagementId: string;
  currentStage: CommercialStage;
  version: number;
}) {
  const router = useRouter();
  return (
    <StageTransitionFormFrame {...props} onSuccess={() => router.refresh()} />
  );
}
