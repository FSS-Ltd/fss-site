"use client";
import { useState } from "react";
import type { JourneyView } from "@/lib/operations/onboarding/command-types";
import { journeyTime } from "@/lib/operations/onboarding/display";
import { jobExplanation } from "@/lib/operations/onboarding/recovery";
import { useJourneyCommand } from "./use-journey-command";
import { RetryFailure } from "./retry-failure";
import { StepRecovery } from "./step-recovery";
import { EmailPreview } from "./email-preview";
import {
  Notice,
  PortalButton,
  PortalCard,
  StatusBadge,
} from "@/components/portal/ui";
import styles from "../agreements/agreements.module.css";
const labels = {
  welcome: "Welcome email",
  proposal_access: "Portal access for signing",
  proposal: "Proposal signing notice",
  invoice: "First invoice",
  invitation: "Portal access after signing",
  activation: "Additional recipient activation",
  thank_you: "Agreement thank-you",
};

function journeyStatus(
  journey: JourneyView,
): "error" | "info" | "success" | "warning" {
  if (journey.failureCode || journey.state === "blocked") return "error";
  if (journey.state === "completed") return "success";
  if (journey.state === "paused") return "warning";
  return "info";
}

export function JourneyTimeline({
  organisationId,
  journey,
  commandEndpoint,
  welcomeDownloadUrl,
}: {
  organisationId: string;
  journey: JourneyView;
  commandEndpoint?: string;
  welcomeDownloadUrl?: string;
}): React.JSX.Element {
  const { submit, pending, message } = useJourneyCommand(
    organisationId,
    commandEndpoint,
  );
  const [cancel, setCancel] = useState(false);
  const terminal = ["completed", "cancelled"].includes(journey.state);
  const command = (action: "pause" | "resume" | "cancel") =>
    submit({
      action,
      journeyId: journey.id,
      expectedGeneration: journey.generation,
      expectedProposalApprovalId: journey.proposalApprovalId,
    });
  return (
    <PortalCard title={journey.agreementTitle || "Client journey"}>
      <StatusBadge status={journeyStatus(journey)}>
        Journey {journey.state}
      </StatusBadge>
      {journey.failureCode && (
        <Notice tone="error">
          Delivery stopped: {journey.failureCode.replaceAll("_", " ")}. Review
          delivery evidence before continuing.
        </Notice>
      )}
      {!journey.proposal && (
        <p>Welcome approved. Proposal is held until its separate approval.</p>
      )}
      {journey.proposal && !journey.currentProposal && !journey.signatureAt && (
        <Notice tone="warning">
          Proposal approval is stale or no longer valid. Review the current
          signing document and approve a new preview. Attempted notices and
          access must be reconciled before replacement.
        </Notice>
      )}
      <dl className={styles.facts}>
        <div>
          <dt>Proposal eligible</dt>
          <dd>
            {(journey.proposalDueAt
              ? journeyTime(journey.proposalDueAt)
              : null) ??
              "Two hours after welcome acceptance, with separate approval"}
          </dd>
        </div>
        <div>
          <dt>Invoice and access eligible</dt>
          <dd>
            {(journey.postSignatureDueAt
              ? journeyTime(journey.postSignatureDueAt)
              : null) ??
              "Following calendar day at 09:00 London after every required signature and retained evidence"}
          </dd>
        </div>
      </dl>
      <div className={styles.form}>
        <div className={styles.actions}>
          <PortalButton
            disabled={pending || terminal || journey.state === "paused"}
            onClick={() => command("pause")}
            type="button"
            variant="secondary"
          >
            Pause
          </PortalButton>
          <PortalButton
            disabled={pending || journey.state !== "paused"}
            onClick={() => command("resume")}
            type="button"
            variant="secondary"
          >
            Resume
          </PortalButton>
          <PortalButton
            disabled={pending || terminal}
            onClick={() => setCancel(true)}
            type="button"
            variant="destructive"
          >
            Cancel remaining steps
          </PortalButton>
        </div>
        {cancel && (
          <div>
            <p>
              Accepted effects remain recorded. This does not void the
              agreement, cancel billing or refund payment. Calls already in
              flight may still complete.
            </p>
            <div className={styles.actions}>
              <PortalButton
                disabled={pending}
                onClick={async () => {
                  if (await command("cancel")) setCancel(false);
                }}
                type="button"
                variant="destructive"
              >
                Confirm cancellation
              </PortalButton>
              <PortalButton
                disabled={pending}
                onClick={() => setCancel(false)}
                type="button"
                variant="secondary"
              >
                Keep journey
              </PortalButton>
            </div>
          </div>
        )}
        <p role="status">{pending ? "Saving…" : message}</p>
      </div>
      <ol className={styles.timeline}>
        {journey.jobs.map((job) => (
          <li key={job.id}>
            <h3>{labels[job.step]}</h3>
            <p>
              {job.recipient} ·{" "}
              <StatusBadge
                status={
                  job.state === "succeeded"
                    ? "success"
                    : job.state === "held" || job.state === "unknown_outcome"
                      ? "warning"
                      : "neutral"
                }
              >
                {job.state.replaceAll("_", " ")}
              </StatusBadge>{" "}
              · eligible {journeyTime(job.dueAt)}
            </p>
            <p>{jobExplanation(job, journey)}</p>
            {job.providerId && (
              <p>
                Provider record: {job.providerId} · accepted{" "}
                {journeyTime(job.acceptedAt)}
              </p>
            )}
            <RetryFailure
              organisationId={organisationId}
              journey={journey}
              job={job}
              commandEndpoint={commandEndpoint}
            />
            <StepRecovery
              organisationId={organisationId}
              journey={journey}
              job={job}
              commandEndpoint={commandEndpoint}
            />
          </li>
        ))}
      </ol>
      {!journey.signatureAt && (
        <p>
          Invoice, post-signature access and thank-you wait for every required
          signature and retained evidence.
        </p>
      )}
      <details>
        <summary>Approved welcome and recipient</summary>
        <a
          href={
            welcomeDownloadUrl ??
            `/api/growth/operations/clients/${organisationId}/journey/${journey.id}/welcome`
          }
        >
          Download approved welcome PDF
        </a>
        <EmailPreview email={journey.welcome.welcome} />
        {journey.welcome.content.pages.map((page, index) => (
          <section key={index}>
            <h3>{page.title}</h3>
            {page.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </section>
        ))}
        <p>Immutable PDF SHA-256: {journey.welcome.pdfHash}</p>
      </details>
      {journey.proposal && (
        <details>
          <summary>Approved proposal and access recipients</summary>
          <p>
            Revision {journey.proposal.revision} · hash{" "}
            {journey.proposal.approvalHash}
          </p>
          <ul>
            {journey.proposal.access.map((a) => (
              <li key={a.email}>
                {a.email}: {a.role.replaceAll("_", " ")}
              </li>
            ))}
          </ul>
          {[
            ...journey.proposal.emails,
            ...journey.proposal.activationEmails,
          ].map((email) => (
            <EmailPreview key={email.to} email={email} />
          ))}
        </details>
      )}
    </PortalCard>
  );
}
