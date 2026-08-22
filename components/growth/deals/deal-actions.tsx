"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { StageTransitionFormFrame } from "@/components/growth/pipeline/stage-transition-form";
import type { CommercialStage } from "@/lib/growth/pipeline/stages";

import styles from "./deals.module.css";

type NextActionBody = {
  expectedVersion: number;
  nextAction: string;
  nextActionDueAt: string;
};

async function defaultPostAction(
  path: string,
  body: NextActionBody,
): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function DealActionsFrame({
  engagementId,
  prospectId,
  stage,
  engagementVersion,
  prospectVersion,
  currentNextAction,
  currentNextActionDueAt,
  onSuccess,
  postAction = defaultPostAction,
}: {
  engagementId: string;
  prospectId: string;
  stage: CommercialStage;
  engagementVersion: number;
  prospectVersion: number;
  currentNextAction: string | null;
  currentNextActionDueAt: string | null;
  onSuccess: () => void;
  postAction?: (path: string, body: NextActionBody) => Promise<Response>;
}) {
  const [nextAction, setNextAction] = useState(currentNextAction ?? "");
  const [nextActionDueAt, setNextActionDueAt] = useState(
    currentNextActionDueAt ? currentNextActionDueAt.slice(0, 10) : "",
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "conflict" | "error";
    message: string;
  } | null>(null);

  async function submitNextAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nextAction.trim() || !nextActionDueAt) return;

    setBusy(true);
    setFeedback(null);
    try {
      const dueAtIso = new Date(`${nextActionDueAt}T09:00:00.000Z`).toISOString();
      const response = await postAction(
        `/api/growth/prospects/${prospectId}/next-action`,
        {
          expectedVersion: prospectVersion,
          nextAction: nextAction.trim(),
          nextActionDueAt: dueAtIso,
        },
      );

      if (response.ok) {
        setFeedback({ tone: "success", message: "Next step saved." });
        onSuccess();
        return;
      }

      if (response.status === 409) {
        setFeedback({
          tone: "conflict",
          message:
            "This record changed since you loaded it. Refresh to see the latest.",
        });
        return;
      }

      const responseBody = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      setFeedback({
        tone: "error",
        message: responseBody?.message ?? "The next step could not be saved.",
      });
    } catch {
      setFeedback({
        tone: "error",
        message:
          "The next step could not be saved. Check your connection and try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className={styles.actionsBar}>
        <StageTransitionFormFrame
          currentStage={stage}
          engagementId={engagementId}
          onSuccess={onSuccess}
          version={engagementVersion}
        />
      </div>

      <form className={styles.nextActionForm} onSubmit={submitNextAction}>
        {feedback && (
          <p className={styles.actionFeedback} data-tone={feedback.tone} role="alert">
            {feedback.message}
          </p>
        )}
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Next step</span>
          <input
            className={styles.textInput}
            onChange={(event) => setNextAction(event.target.value)}
            type="text"
            value={nextAction}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Due date</span>
          <input
            className={styles.textInput}
            onChange={(event) => setNextActionDueAt(event.target.value)}
            type="date"
            value={nextActionDueAt}
          />
        </label>
        <button
          className={styles.actionButton}
          data-variant="primary"
          disabled={busy || !nextAction.trim() || !nextActionDueAt}
          type="submit"
        >
          {busy ? "Saving…" : "Save next step"}
        </button>
      </form>
    </div>
  );
}

export function DealActions(props: {
  engagementId: string;
  prospectId: string;
  stage: CommercialStage;
  engagementVersion: number;
  prospectVersion: number;
  currentNextAction: string | null;
  currentNextActionDueAt: string | null;
}) {
  const router = useRouter();
  return <DealActionsFrame {...props} onSuccess={() => router.refresh()} />;
}
