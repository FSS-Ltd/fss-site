import { FileText, MailQuestion, PenLine } from "lucide-react";
import {
  PortalActionLink,
  PortalCard,
  StatusBadge,
  type PortalStatus,
} from "@/components/portal/ui";
import type { SigningApproval } from "@/lib/operations/agreements/signing-types";
import type { AgreementDeliveryStatus } from "@/lib/operations/agreements/agreement-notification-repository";
import {
  allRequiredSignaturesRecorded,
  hasCompleteSigningEvidence,
} from "./presentation";
import { AgreementDeliveryAction } from "./agreement-delivery-action";
import { agreementStage } from "@/lib/operations/agreements/stage";
import { AgreementStageTimeline } from "./agreement-stage-timeline";
import styles from "./agreements.module.css";

type StaffSigningStatusProps = Readonly<{
  approval: SigningApproval;
  controls?: React.ReactNode;
  downloadBase: string;
  deliveries?: readonly AgreementDeliveryStatus[];
  commandEndpoint?: string;
}>;

type SigningPresentation = Readonly<{
  description: string;
  label: string;
  tone: PortalStatus;
}>;

function presentationFor(approval: SigningApproval): SigningPresentation {
  if (hasCompleteSigningEvidence(approval)) {
    return {
      description:
        "Every named signer has verified evidence on the retained agreement revision.",
      label: "Signed and recorded",
      tone: "success",
    };
  }

  if (
    approval.status === "approved" &&
    allRequiredSignaturesRecorded(approval)
  ) {
    if (approval.completionFailureCode) {
      return {
        description:
          "Every signature is recorded, but preparing the signed copy failed. Retry document processing or ask FSS support to review the worker.",
        label: "Document needs attention",
        tone: "warning",
      };
    }
    return {
      description:
        "Every required signer has signed. The final PDF and retained evidence are being prepared.",
      label: "Preparing signed copy",
      tone: "info",
    };
  }

  switch (approval.status) {
    case "prepared":
      return {
        description:
          "The immutable document is prepared but an FSS staff member has not approved it for signing.",
        label: "Awaiting FSS approval",
        tone: "warning",
      };
    case "approved":
      return {
        description:
          "The approved agreement is open for its named signers. Delivery confirmation is not part of this signing record.",
        label: "Ready for the named signers",
        tone: "info",
      };
    case "completed":
      return {
        description:
          "The signing workflow is complete but the retained evidence is incomplete. Do not describe this agreement as signed.",
        label: "Evidence needs review",
        tone: "error",
      };
    case "declined":
      return {
        description: "A signer declined this exact revision.",
        label: "Declined",
        tone: "error",
      };
    case "cancelled":
      return {
        description:
          "This signing request was cancelled before every signature was recorded.",
        label: "Cancelled",
        tone: "error",
      };
    case "superseded":
      return {
        description:
          "A newer agreement revision replaced this signing request.",
        label: "Superseded",
        tone: "neutral",
      };
    case "expired":
      return {
        description:
          "The signing deadline passed before every required signer completed the request.",
        label: "Expired",
        tone: "error",
      };
  }
}

function formatSignedAt(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export function StaffSigningStatus({
  approval,
  controls,
  deliveries = [],
  downloadBase,
  commandEndpoint,
}: StaffSigningStatusProps): React.JSX.Element {
  const presentation = presentationFor(approval);
  const complete = hasCompleteSigningEvidence(approval);
  const signaturesRecorded = allRequiredSignaturesRecorded(approval);

  return (
    <article
      className={styles.detail}
      aria-labelledby={`signing-status-${approval.id}`}
    >
      <div className={styles.detailStatus}>
        <StatusBadge status={presentation.tone}>
          {presentation.label}
        </StatusBadge>
        <span>
          {approval.organisationLegalName} · Revision {approval.revision}
        </span>
      </div>
      <PortalCard
        description={presentation.description}
        headingId={`signing-status-${approval.id}`}
        title={approval.title}
      >
        <AgreementStageTimeline
          stage={agreementStage({
            signing: approval,
            completeEvidence: complete,
          })}
          fixedTerms
        />
        <p className={styles.prose}>
          Retained agreement version {approval.agreementVersion} ·{" "}
          {approval.requiredSigners.length} required{" "}
          {approval.requiredSigners.length === 1 ? "signer" : "signers"}.
        </p>
        <div className={styles.actionRow}>
          <PortalActionLink href={`${downloadBase}/source`} variant="secondary">
            <FileText aria-hidden="true" size={16} />
            Preview agreement
          </PortalActionLink>
          {complete ? (
            <PortalActionLink
              href={`${downloadBase}/signed`}
              variant="secondary"
            >
              <FileText aria-hidden="true" size={16} />
              Open signed copy
            </PortalActionLink>
          ) : null}
        </div>
      </PortalCard>
      {controls}
      <PortalCard title="Delivery and signing">
        <ul
          className={`${styles.schedule} ${styles.signingSchedule}`}
          aria-label="Required signing status"
        >
          {approval.requiredSigners.map((signer) => {
            const signature = approval.signatures.find(
              (item) => item.email.toLowerCase() === signer.toLowerCase(),
            );
            return (
              <li key={signer}>
                <span className={styles.signingScheduleLabel}>
                  {signature?.typedName ?? signer}
                </span>
                {signature ? (
                  <StatusBadge status="success">
                    Signed {formatSignedAt(signature.signedAt)}
                  </StatusBadge>
                ) : (
                  <StatusBadge
                    status={
                      approval.status === "approved" ? "warning" : "neutral"
                    }
                  >
                    {approval.status === "prepared"
                      ? "Not yet open"
                      : approval.status === "approved"
                        ? "Signature pending"
                        : "No signature retained"}
                  </StatusBadge>
                )}
              </li>
            );
          })}
          {approval.requiredSigners.map((recipient) => {
            const delivery = deliveries.find(
              (item) => item.recipient === recipient,
            );
            const label =
              delivery?.status === "delivered"
                ? "Delivered"
                : delivery?.status === "sent"
                  ? "Sent; delivery unconfirmed"
                  : delivery?.status === "queued" ||
                      delivery?.status === "sending"
                    ? "Queued"
                    : delivery?.status === "failed"
                      ? "Delivery failed"
                      : delivery?.status === "suppressed"
                        ? "No longer required"
                        : "Delivery unknown";
            return (
              <li key={`delivery-${recipient}`}>
                <span className={styles.signingScheduleLabel}>
                  <MailQuestion aria-hidden="true" size={16} />
                  <span>Delivery to {recipient}</span>
                </span>
                <StatusBadge
                  status={
                    delivery?.status === "delivered"
                      ? "success"
                      : delivery?.status === "failed"
                        ? "error"
                        : "neutral"
                  }
                >
                  {approval.status === "prepared" ? "Not started" : label}
                </StatusBadge>
                {commandEndpoint &&
                delivery &&
                approval.status === "approved" &&
                !approval.signatures.some((item) => item.email === recipient) &&
                (delivery.status === "sent" ||
                  delivery.status === "failed" ||
                  delivery.status === "unknown") ? (
                  <AgreementDeliveryAction
                    source={{ type: "signing", id: approval.id }}
                    delivery={delivery}
                    endpoint={commandEndpoint}
                  />
                ) : null}
              </li>
            );
          })}
          <li>
            <span className={styles.signingScheduleLabel}>
              <PenLine aria-hidden="true" size={16} />
              <span>Signing evidence</span>
            </span>
            <StatusBadge
              status={
                complete
                  ? "success"
                  : approval.status === "approved"
                    ? "warning"
                    : "neutral"
              }
            >
              {complete
                ? "All required signatures retained"
                : signaturesRecorded
                  ? "All signatures recorded; final copy processing"
                  : approval.status === "prepared"
                    ? "No signatures yet"
                    : approval.status === "approved"
                      ? "Signature pending"
                      : "Evidence incomplete"}
            </StatusBadge>
          </li>
        </ul>
      </PortalCard>
      {!complete ? (
        <p className={styles.muted}>
          Approval is not signature. Delivery is not inferred from a queued
          request; this agreement is signed only when evidence for every
          required signer is retained.
        </p>
      ) : null}
    </article>
  );
}
