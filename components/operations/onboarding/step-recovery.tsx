"use client";
import type {
  JourneyJob,
  JourneyView,
} from "@/lib/operations/onboarding/command-types";
import { canReconcile } from "@/lib/operations/onboarding/recovery";
import {
  PortalButton,
  PortalCheckbox,
  PortalField,
} from "@/components/portal/ui";
import { useJourneyCommand } from "./use-journey-command";
import styles from "../agreements/agreements.module.css";
export function StepRecovery({
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
          <PortalField label="Provider acceptance ID" required>
            <input name="providerId" required maxLength={300} />
          </PortalField>
          <PortalField
            label="Original acceptance time (ISO 8601, with timezone)"
            required
          >
            <input
              name="acceptedAt"
              required
              placeholder="2026-09-08T10:15:00Z"
            />
          </PortalField>
          <PortalField label="Review reference" required>
            <input name="reviewReference" required maxLength={500} />
          </PortalField>
          <PortalCheckbox
            label="I verified this acceptance for this exact recipient and effect."
            name="confirmed"
            required
          />
          <PortalButton disabled={pending} loading={pending} type="submit">
            {pending ? "Recording…" : "Record acceptance"}
          </PortalButton>
        </fieldset>
        <p role="status">{message}</p>
      </form>
    </details>
  );
}
