"use client";
import { useState } from "react";
import type { JourneyView } from "@/lib/operations/onboarding/command-types";
import { journeyTime } from "@/lib/operations/onboarding/display";
import { jobExplanation } from "@/lib/operations/onboarding/recovery";
import { useJourneyCommand } from "./use-journey-command";
import { RetryFailure } from "./retry-failure";
import { StepRecovery } from "./step-recovery";
import { EmailPreview } from "./email-preview";
import ui from "../shared/operations-ui.module.css";
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
export function JourneyTimeline({
  organisationId,
  journey,
}: {
  organisationId: string;
  journey: JourneyView;
}): React.JSX.Element {
  const { submit, pending, message } = useJourneyCommand(organisationId);
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
    <article className={styles.card}>
      <h2>{journey.agreementTitle || "Client journey"}</h2>
      <p className={ui.statusChip}>Journey {journey.state}</p>
      {journey.failureCode && (
        <p role="alert">
          Delivery stopped: {journey.failureCode.replaceAll("_", " ")}. Review
          delivery evidence before continuing.
        </p>
      )}
      {!journey.proposal && (
        <p>Welcome approved. Proposal is held until its separate approval.</p>
      )}
      {journey.proposal && !journey.currentProposal && !journey.signatureAt && (
        <p role="alert">
          Proposal approval is stale or no longer valid. Review the current
          signing document and approve a new preview. Attempted notices and
          access must be reconciled before replacement.
        </p>
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
          <button
            disabled={pending || terminal || journey.state === "paused"}
            onClick={() => command("pause")}
          >
            Pause
          </button>
          <button
            disabled={pending || journey.state !== "paused"}
            onClick={() => command("resume")}
          >
            Resume
          </button>
          <button
            disabled={pending || terminal}
            onClick={() => setCancel(true)}
          >
            Cancel remaining steps
          </button>
        </div>
        {cancel && (
          <div>
            <p>
              Accepted effects remain recorded. This does not void the
              agreement, cancel billing or refund payment. Calls already in
              flight may still complete.
            </p>
            <div className={styles.actions}>
              <button
                disabled={pending}
                onClick={async () => {
                  if (await command("cancel")) setCancel(false);
                }}
              >
                Confirm cancellation
              </button>
              <button disabled={pending} onClick={() => setCancel(false)}>
                Keep journey
              </button>
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
              <span className={ui.statusChip}>
                {job.state.replaceAll("_", " ")}
              </span>{" "}
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
            />
            <StepRecovery
              organisationId={organisationId}
              journey={journey}
              job={job}
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
          href={`/api/growth/operations/clients/${organisationId}/journey/${journey.id}/welcome`}
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
    </article>
  );
}
