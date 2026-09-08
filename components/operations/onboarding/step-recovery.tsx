"use client";
import type {
  JourneyJob,
  JourneyView,
} from "@/lib/operations/onboarding/command-types";
import { canReconcile } from "@/lib/operations/onboarding/recovery";
import { useJourneyCommand } from "./use-journey-command";
import styles from "../agreements/agreements.module.css";
export function StepRecovery({
  organisationId,
  journey,
  job,
}: {
  organisationId: string;
  journey: JourneyView;
  job: JourneyJob;
}): React.JSX.Element | null {
  const { submit, pending, message } = useJourneyCommand(organisationId);
  if (!canReconcile(job)) return null;
  return (
    <details>
      <summary>Record verified acceptance</summary>
      <p>
        Use the original provider record and its original acceptance time. An
        empty search result does not prove that sending again is safe.
      </p>
      <form
        className={styles.form}
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          await submit({
            action: "reconcile",
            journeyId: journey.id,
            expectedGeneration: journey.generation,
            expectedProposalApprovalId: journey.proposalApprovalId,
            jobId: job.id,
            providerId: data.get("providerId"),
            acceptedAt: data.get("acceptedAt"),
            reviewReference: data.get("reviewReference"),
            confirmed: data.get("confirmed") === "on",
          });
        }}
      >
        <fieldset disabled={pending}>
          <label className={styles.field}>
            Provider acceptance ID
            <input name="providerId" required maxLength={300} />
          </label>
          <label className={styles.field}>
            Original acceptance time (ISO 8601, with timezone)
            <input
              name="acceptedAt"
              required
              placeholder="2026-09-08T10:15:00Z"
            />
          </label>
          <label className={styles.field}>
            Review reference
            <input name="reviewReference" required maxLength={500} />
          </label>
          <label>
            <input name="confirmed" type="checkbox" required />I verified this
            acceptance for this exact recipient and effect.
          </label>
          <button className={styles.primary} disabled={pending}>
            {pending ? "Recording…" : "Record acceptance"}
          </button>
        </fieldset>
        <p role="status">{message}</p>
      </form>
    </details>
  );
}
