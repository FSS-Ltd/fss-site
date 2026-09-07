"use client";

import { useState, type FormEvent } from "react";
import type { ClientRequestDetail } from "@/lib/operations/requests/types";
import type { RequestAction } from "./actions";
import { useRequestAction } from "./use-request-action";
import styles from "./requests.module.css";

export function ReviewActions({
  request,
  commandAction,
  onRefresh,
}: {
  request: ClientRequestDetail;
  commandAction: RequestAction;
  onRefresh: () => void;
}): React.JSX.Element | null {
  const [feedback, setFeedback] = useState("");
  const [decision, setDecision] = useState<"accept" | "request_changes">(
    "accept",
  );
  const [confirmedVersion, setConfirmedVersion] = useState<string | null>(null);
  const reviewVersion = `${request.version}:${request.reviewCycle}:${request.deliverableVersion}`;
  const confirmed = confirmedVersion === reviewVersion;
  const { pending, result, message, run } = useRequestAction(
    commandAction,
    onRefresh,
  );
  if (request.status !== "ready_for_review") return null;
  if (!request.canReview)
    return (
      <p className={styles.notice}>
        Your organisation owner or designated reviewer can accept this
        deliverable or request changes. You can share feedback in the
        conversation.
      </p>
    );
  if (!request.deliverableVersion)
    return (
      <p className={styles.notice}>
        Your FSS team is preparing the version for review.
      </p>
    );
  const deliverableVersion = request.deliverableVersion;
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (decision === "accept" && !confirmed) return;
    if (decision === "request_changes" && !feedback.trim()) return;
    const command = {
      expectedVersion: request.version,
      deliverableVersion,
      reviewCycle: request.reviewCycle,
    };
    const saved = await run(
      decision === "accept"
        ? { ...command, action: "accept" }
        : { ...command, action: "request_changes", feedback: feedback.trim() },
      decision === "accept"
        ? "Deliverable accepted."
        : "Changes requested. Your feedback has been saved.",
    );
    if (saved) {
      setFeedback("");
      setConfirmedVersion(null);
    }
  }
  return (
    <section className={styles.review} aria-labelledby="request-review-heading">
      <p className={styles.eyebrow}>Your decision</p>
      <h2 id="request-review-heading" className={styles.sectionTitle}>
        Review {deliverableVersion}
      </h2>
      <p className={styles.copy}>{request.reviewInstructions}</p>
      <form onSubmit={submit} aria-busy={pending} className={styles.form}>
        <fieldset
          disabled={
            pending ||
            (result?.ok === true && request.version <= result.request.version)
          }
          className={styles.fieldset}
        >
          <label className={styles.field}>
            Decision
            <select
              value={decision}
              onChange={(event) => {
                setDecision(
                  event.target.value === "accept"
                    ? "accept"
                    : "request_changes",
                );
                setConfirmedVersion(null);
              }}
              className={styles.input}
            >
              <option value="accept">Accept this version</option>
              <option value="request_changes">Request changes</option>
            </select>
          </label>
          {decision === "accept" ? (
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) =>
                  setConfirmedVersion(
                    event.target.checked ? reviewVersion : null,
                  )
                }
                required
              />
              I have reviewed {deliverableVersion} and accept this deliverable.
            </label>
          ) : (
            <label className={styles.field}>
              What needs to change?
              <textarea
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                required
                maxLength={10000}
                rows={5}
                className={styles.input}
              />
              <span className={styles.note}>
                Be specific about the result you need. Do not include
                credentials.
              </span>
            </label>
          )}
          <button
            type="submit"
            className={styles.primary}
            disabled={
              pending || (decision === "accept" ? !confirmed : !feedback.trim())
            }
          >
            {pending
              ? "Saving decision…"
              : decision === "accept"
                ? "Accept deliverable"
                : "Send change request"}
          </button>
        </fieldset>
        <p role="status" aria-atomic="true" className={styles.feedback}>
          {message}
        </p>
        {result && !result.ok && result.conflict && (
          <button
            type="button"
            onClick={onRefresh}
            className={styles.secondary}
          >
            Refresh request details
          </button>
        )}
      </form>
    </section>
  );
}
