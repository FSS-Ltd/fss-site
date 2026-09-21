"use client";

import { useState, type FormEvent } from "react";
import {
  Notice,
  PortalButton,
  PortalCard,
  PortalTextarea,
} from "@/components/portal/ui";
import type { ClientRequestDetail } from "@/lib/operations/requests/types";
import type { RequestAction } from "./actions";
import { useRequestAction } from "./use-request-action";
import styles from "./requests.module.css";

type ReviewDecision = "accept" | "request_changes";

export function ReviewActions({
  request,
  commandAction,
  initialConflict = false,
  initialDecision = "accept",
  onRefresh,
}: {
  request: ClientRequestDetail;
  commandAction: RequestAction;
  initialConflict?: boolean;
  initialDecision?: ReviewDecision;
  onRefresh: () => void;
}): React.JSX.Element | null {
  const [feedback, setFeedback] = useState("");
  const [decision, setDecision] = useState<ReviewDecision>(initialDecision);
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
      <Notice tone="info">
        Your organisation owner or designated reviewer can accept this
        deliverable or request changes. You can share feedback in the
        conversation.
      </Notice>
    );
  if (!request.deliverableVersion)
    return (
      <Notice tone="info">
        Your FSS team is preparing the version for review.
      </Notice>
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
        ? `${deliverableVersion} accepted.`
        : "Changes requested. Your feedback has been saved.",
    );
    if (saved) {
      setFeedback("");
      setConfirmedVersion(null);
    }
  }

  return (
    <section className={styles.review} aria-label="Review deliverable">
      <PortalCard
        description={request.reviewInstructions}
        title="Does this meet the agreed outcome?"
        tone="dark"
      >
        <p className={styles.reviewVersion}>
          Your decision applies to {deliverableVersion}.
        </p>
      </PortalCard>
      <PortalCard title="What changed">
        <p className={styles.prose}>
          {request.publicSummary ||
            "FSS has not added a public summary for this version yet."}
        </p>
      </PortalCard>

      <PortalCard
        description="Accept this version when you are happy with the agreed work, or request changes with specific feedback."
        title="Your decision"
        tone="accent"
      >
        <form onSubmit={submit} aria-busy={pending} className={styles.form}>
          <fieldset
            disabled={
              pending ||
              (result?.ok === true && request.version <= result.request.version)
            }
            className={styles.fieldset}
          >
            {decision === "accept" ? (
              <>
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
                  I have reviewed {deliverableVersion} and accept this
                  deliverable.
                </label>
                <div className={styles.actionRow}>
                  <PortalButton
                    disabled={pending || !confirmed}
                    loading={pending}
                    type="submit"
                  >
                    Accept {deliverableVersion}
                  </PortalButton>
                  <PortalButton
                    onClick={() => {
                      setDecision("request_changes");
                      setConfirmedVersion(null);
                    }}
                    type="button"
                    variant="secondary"
                  >
                    Request changes
                  </PortalButton>
                </div>
              </>
            ) : (
              <>
                <PortalTextarea
                  hint="Be specific about the result you need. Do not include credentials."
                  label="What needs changing?"
                  maxLength={10000}
                  onChange={(event) => setFeedback(event.target.value)}
                  required
                  rows={5}
                  value={feedback}
                />
                <div className={styles.actionRow}>
                  <PortalButton
                    disabled={pending || !feedback.trim()}
                    loading={pending}
                    type="submit"
                  >
                    Send feedback
                  </PortalButton>
                  <PortalButton
                    onClick={() => setDecision("accept")}
                    type="button"
                    variant="secondary"
                  >
                    Back to acceptance
                  </PortalButton>
                </div>
              </>
            )}
          </fieldset>
          <p role="status" aria-atomic="true" className={styles.feedback}>
            {message}
          </p>
          {initialConflict || (result && !result.ok && result.conflict) ? (
            <Notice
              action={
                <PortalButton
                  onClick={onRefresh}
                  type="button"
                  variant="secondary"
                >
                  Review latest version
                </PortalButton>
              }
              tone="warning"
            >
              <strong>This request has changed.</strong> Your feedback has
              stayed in this form. Review the latest version before submitting a
              decision.
            </Notice>
          ) : null}
        </form>
      </PortalCard>
    </section>
  );
}
