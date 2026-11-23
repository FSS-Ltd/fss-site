"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./campaign-overview.module.css";

type Action = "approve" | "pause" | "resume";

export function CampaignLifecycleActions({
  id,
  version,
  status,
  approved,
}: {
  id: string;
  version: number;
  status: string;
  approved: boolean;
}): React.JSX.Element | null {
  const router = useRouter();
  const [intent, setIntent] = useState<Action | null>(null);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const retry = useRef<{ payload: string; requestId: string } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const policy = useRef(`${id}:${version}:${status}:${approved}`);
  useEffect(() => {
    const current = `${id}:${version}:${status}:${approved}`;
    if (policy.current !== current) {
      policy.current = current;
      setIntent(null);
      restoreFocus.current = true;
    }
    if (!intent && !pending && restoreFocus.current) {
      button.current?.focus();
      restoreFocus.current = false;
    }
  }, [id, version, status, approved, intent, pending]);
  if (status === "revoked") return null;
  const action: Action =
    status === "approved" ? "pause" : approved ? "resume" : "approve";
  const label =
    action === "approve"
      ? "Approve policy"
      : action === "resume"
        ? "Resume campaign"
        : "Pause campaign";
  async function submit() {
    if (!intent) return;
    const payload = JSON.stringify({
      type: intent,
      campaignId: id,
      policyVersion: version,
    });
    if (retry.current?.payload !== payload)
      retry.current = { payload, requestId: crypto.randomUUID() };
    setPending(true);
    setFeedback("");
    try {
      const response = await fetch("/api/growth/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: intent,
          campaignId: id,
          policyVersion: version,
          requestId: retry.current.requestId,
        }),
      });
      if (!response.ok) {
        setFeedback(
          response.status === 401
            ? "Your session has expired. Sign in again."
            : response.status === 409
              ? "Campaign changed or is not ready. Review the current policy and account."
              : "Could not save. Try again.",
        );
        if (response.status === 409) router.refresh();
        return;
      }
      retry.current = null;
      restoreFocus.current = true;
      setIntent(null);
      setFeedback(
        intent === "approve"
          ? "Policy approval recorded. Check the refreshed campaign state."
          : intent === "pause"
            ? "Campaign paused."
            : "Campaign resumed.",
      );
      router.refresh();
    } catch {
      setFeedback("Could not save. Try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className={styles.actions}>
      <button
        ref={button}
        type="button"
        onClick={() => {
          setIntent(action);
          setFeedback("");
        }}
        disabled={pending || intent !== null}
      >
        {label}
      </button>
      {intent && (
        <div
          className={styles.confirm}
          role="group"
          aria-label={`Confirm ${intent}`}
        >
          <p>
            {intent === "approve"
              ? "Approve this version. Approval keeps the campaign paused."
              : intent === "pause"
                ? "Pause this campaign and its pending follow-ups."
                : "Resume this approved campaign if account and policy checks pass."}
          </p>
          <button autoFocus type="button" disabled={pending} onClick={submit}>
            {pending ? "Saving…" : `Confirm ${intent}`}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              restoreFocus.current = true;
              setIntent(null);
            }}
          >
            Cancel
          </button>
        </div>
      )}
      {feedback && <p role="status">{feedback}</p>}
    </div>
  );
}
