"use client";

import { useMemo } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Notice, PortalButton, PortalCard } from "@/components/portal/ui";
import { validateAgreementBuilderDraft } from "@/lib/operations/agreements/builder-draft-validation";
import { totalLinePence } from "@/lib/operations/agreements/validation";
import {
  BuilderSection,
  type BuilderStepProps,
  formatGbp,
} from "./agreement-builder-step-support";
import { AgreementBuilderReadinessChecks } from "./agreement-builder-readiness-checks";
import { AgreementBuilderSummary } from "./agreement-builder-summary";
import styles from "./agreements.module.css";
export function AgreementBuilderReviewStep({
  agreement,
  content,
  draftExists,
  finalise,
  onSave,
  pending,
}: BuilderStepProps &
  Readonly<{
    draftExists: boolean;
    finalise: () => Promise<void>;
  }>): React.JSX.Element {
  const readiness = useMemo(
    () => validateAgreementBuilderDraft(content),
    [content],
  );
  const totals = useMemo(() => {
    if (!agreement.lines)
      return {
        setup: "0",
        recurring: [] as { interval: number; amount: string }[],
      };
    try {
      const setup = agreement.lines
        .filter((line) => !line.recurrenceMonths)
        .reduce((sum, line) => sum + BigInt(totalLinePence(line)), BigInt(0));
      const recurring = new Map<number, bigint>();
      for (const line of agreement.lines.filter(
        (line) => line.recurrenceMonths,
      )) {
        recurring.set(
          line.recurrenceMonths,
          (recurring.get(line.recurrenceMonths) ?? BigInt(0)) +
            BigInt(totalLinePence(line)),
        );
      }
      return {
        setup: setup.toString(),
        recurring: [...recurring].map(([interval, amount]) => ({
          interval,
          amount: amount.toString(),
        })),
      };
    } catch {
      return {
        setup: "0",
        recurring: [] as { interval: number; amount: string }[],
      };
    }
  }, [agreement.lines]);

  return (
    <BuilderSection
      icon={<CheckCircle2 size={20} />}
      title="Review before sending"
    >
      <div className={styles.metrics}>
        <div>
          <p className={styles.metric}>
            {formatGbp(totals.setup, agreement.currency)}
          </p>
          <span>One-off setup fees</span>
        </div>
        {totals.recurring.map(({ interval, amount }) => (
          <div key={interval}>
            <p className={styles.metric}>
              {formatGbp(amount, agreement.currency)}
            </p>
            <span>
              Every {interval} {interval === 1 ? "month" : "months"}
            </span>
          </div>
        ))}
        <div>
          <p className={styles.metric}>
            {formatGbp(agreement.requiredDepositPence, agreement.currency)}
          </p>
          <span>Initial deposit</span>
        </div>
        <div>
          <p className={styles.metric}>{agreement.signatories?.length ?? 0}</p>
          <span>Required signers</span>
        </div>
      </div>
      <PortalCard
        className={styles.documentPreview}
        title={agreement.title || "Agreement draft"}
      >
        <AgreementBuilderSummary
          agreement={agreement}
          commercialOffer={content.commercialOffer}
        />
      </PortalCard>
      <AgreementBuilderReadinessChecks
        readiness={readiness}
        engagementLinked={Boolean(content.engagementId)}
        signerCount={agreement.signatories?.length ?? 0}
        pending={pending}
        onRepair={(step) => onSave(step, content)}
      />
      <Notice tone="warning">
        <strong>
          {content.commercialOffer
            ? content.commercialOffer.spec.cash?.mode === "client_proposed" ||
              content.commercialOffer.spec.revenueShare?.mode ===
                "client_proposed"
              ? "Request the client's budget"
              : "Publish reviewed choices"
            : "Prepare signing, not signed."}
        </strong>
        <p>
          {content.commercialOffer
            ? "The client will see these terms and available pricing choices. Any client proposal remains pending until FSS approves and sends the final agreement for signing."
            : "Creating this agreement preserves the reviewed draft. Prepare its signing document on the agreement record before opening it for the required signers."}
        </p>
      </Notice>
      <div className={styles.actionRow}>
        <PortalButton
          disabled={!draftExists || pending || !readiness.success}
          disabledReason={
            !draftExists
              ? "Save this review before creating the agreement record."
              : !readiness.success
                ? "Complete the listed details before sending."
                : undefined
          }
          loading={pending}
          onClick={() => void finalise()}
          type="button"
        >
          {content.commercialOffer
            ? content.commercialOffer.spec.cash?.mode === "client_proposed" ||
              content.commercialOffer.spec.revenueShare?.mode ===
                "client_proposed"
              ? "Send budget request"
              : "Publish payment offer"
            : "Create agreement"}
        </PortalButton>
        <PortalButton
          disabled={pending}
          onClick={() => void onSave("review", content)}
          type="button"
          variant="quiet"
        >
          Save draft
        </PortalButton>
        <PortalButton
          disabled={pending}
          onClick={() => void onSave("document", content)}
          type="button"
          variant="secondary"
        >
          <ArrowLeft aria-hidden="true" size={16} /> Back to document
        </PortalButton>
      </div>
    </BuilderSection>
  );
}
