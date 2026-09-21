"use client";
import type {
  JourneyJob,
  JourneyView,
} from "@/lib/operations/onboarding/command-types";
import { canRetry } from "@/lib/operations/onboarding/recovery";
import {
  PortalButton,
  PortalCheckbox,
  PortalField,
} from "@/components/portal/ui";
import { useJourneyCommand } from "./use-journey-command";
import styles from "../agreements/agreements.module.css";
export function RetryFailure({
  organisationId,
  journey,
  job,
  commandEndpoint,
}: {
  organisationId: string;
  journey: JourneyView;
  job: JourneyJob;
  commandEndpoint?: string;
}): React.JSX.Element | null {
  const { submit, pending, message } = useJourneyCommand(
    organisationId,
    commandEndpoint,
  );
  if (!canRetry(job, journey)) return null;
  return (
    <details>
      <summary>Retry the reviewed failure</summary>
      <p>
        Correct the reported configuration or access issue first. This retains
        the approved content, original invoice obligation and provider key. An
        uncertain outcome cannot use this action.
      </p>
      <form
        className={styles.form}
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          await submit({
            action: "retry",
            journeyId: journey.id,
            expectedGeneration: journey.generation,
            expectedProposalApprovalId: journey.proposalApprovalId,
            jobId: job.id,
            reviewReference: data.get("reviewReference"),
            confirmed: data.get("confirmed") === "on",
          });
        }}
      >
        <fieldset disabled={pending}>
          <PortalField label="Recovery review reference" required>
            <input name="reviewReference" required maxLength={200} />
          </PortalField>
          <PortalCheckbox
            label="I reviewed and corrected the definite failure."
            name="confirmed"
            required
          />
          <PortalButton disabled={pending} loading={pending} type="submit">
            {pending ? "Queuing…" : "Retry this step"}
          </PortalButton>
        </fieldset>
        <p role="status">{message}</p>
      </form>
    </details>
  );
}
