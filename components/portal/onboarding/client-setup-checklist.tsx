import { CheckCircle2, Circle } from "lucide-react";
import { Notice, PortalActionLink, StatusBadge } from "@/components/portal/ui";
import type { ClientSetupChecklist } from "@/lib/operations/onboarding/client-checklist";
import { portalPath } from "@/lib/operations/auth/portal-url";
import styles from "./client-onboarding.module.css";

type ClientSetupChecklistProps = {
  checklist: ClientSetupChecklist;
  enabled: boolean;
  organisationId: string;
};

const checklistItems = [
  {
    key: "agreementSigned",
    title: "Agreement signed",
    complete: "Your signed agreement is retained in your workspace.",
    pending: "Review and sign the approved agreement when it is ready.",
  },
  {
    key: "billingReady",
    title: "First invoice ready",
    complete: "Your first agreed invoice has been issued.",
    pending:
      "Your first invoice will appear after all required signatures and the scheduled activation time.",
  },
  {
    key: "filesReady",
    title: "Files available",
    complete: "Cleared files are available in your client workspace.",
    pending:
      "Files will appear here after they have been safely checked and shared with your workspace.",
  },
  {
    key: "serviceReady",
    title: "Service ready",
    complete: "FSS has recorded that your service is ready to begin.",
    pending:
      "FSS will confirm readiness after the agreed prerequisites are recorded.",
  },
] as const satisfies ReadonlyArray<{
  key: keyof ClientSetupChecklist;
  title: string;
  complete: string;
  pending: string;
}>;

export function ClientSetupChecklist({
  checklist,
  enabled,
  organisationId,
}: ClientSetupChecklistProps): React.JSX.Element {
  if (!enabled) {
    return (
      <Notice tone="info">
        <strong>Getting started is unavailable.</strong>
        <p>
          FSS has not enabled onboarding delivery for this workspace. Existing
          agreements and billing records remain available in their usual places.
        </p>
      </Notice>
    );
  }

  const agreementCopy = {
    awaiting_signature: [
      "Waiting",
      "Review and sign the approved agreement when it is ready.",
    ],
    partially_signed: [
      "Partly signed",
      "A signature is recorded. Remaining signers still need to sign.",
    ],
    signatures_recorded: [
      "Signatures recorded",
      "Every required signature is recorded.",
    ],
    document_processing: [
      "Preparing copy",
      "Every required signature is recorded. Your signed copy is being prepared.",
    ],
    completed: [
      "Complete",
      "Your signed agreement is retained in your workspace.",
    ],
    attention_required: [
      "Needs review",
      "Signatures are recorded, but the final document needs FSS review.",
    ],
  } as const;
  const query = `?organisationId=${encodeURIComponent(organisationId)}`;
  return (
    <ol className={styles.milestoneList} aria-label="Client setup checklist">
      {checklistItems.map((item) => {
        const complete = checklist[item.key];
        const agreementState =
          item.key === "agreementSigned" ? checklist.agreementState : undefined;
        const statusLabel = agreementState
          ? agreementCopy[agreementState][0]
          : complete
            ? "Complete"
            : "Waiting";
        const description = agreementState
          ? agreementCopy[agreementState][1]
          : complete
            ? item.complete
            : item.pending;
        const href =
          item.key === "agreementSigned"
            ? `${portalPath("/portal/agreements")}${query}`
            : item.key === "billingReady"
              ? `${portalPath("/portal/billing")}${query}`
              : null;
        return (
          <li className={styles.milestoneRow} key={item.key}>
            <span className={styles.milestoneLabel}>
              {complete ? (
                <CheckCircle2 aria-hidden="true" size={18} />
              ) : (
                <Circle aria-hidden="true" size={18} />
              )}
              {item.title}
            </span>
            <div>
              <StatusBadge
                status={
                  complete
                    ? "success"
                    : agreementState === "attention_required"
                      ? "warning"
                      : agreementState === "document_processing" ||
                          agreementState === "signatures_recorded"
                        ? "info"
                        : "neutral"
                }
              >
                {statusLabel}
              </StatusBadge>
              <p className={styles.taskCopy}>{description}</p>
            </div>
            {href ? (
              <PortalActionLink href={href} variant="secondary">
                {item.key === "agreementSigned"
                  ? "View agreement"
                  : "View invoices"}
              </PortalActionLink>
            ) : null}
          </li>
        );
      })}
      <li className={styles.milestoneRow}>
        <span className={styles.milestoneLabel}>Payment method setup</span>
        <div>
          <StatusBadge status="info">Available</StatusBadge>
          <p className={styles.taskCopy}>
            Choose a method for future payments. Adding details makes no charge
            today.
          </p>
        </div>
        <PortalActionLink
          href={`${portalPath("/portal/billing")}${query}`}
          variant="secondary"
        >
          View payment options
        </PortalActionLink>
      </li>
    </ol>
  );
}
