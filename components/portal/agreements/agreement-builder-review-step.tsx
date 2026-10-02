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
  const total = useMemo(() => {
    if (!agreement.lines) return "0";
    try {
      return agreement.lines
        .reduce((sum, line) => sum + BigInt(totalLinePence(line)), BigInt(0))
        .toString();
    } catch {
      return "0";
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
            {formatGbp(total, agreement.currency)}
          </p>
          <span>
            {content.commercialOffer
              ? "Priced fees before selection"
              : "Agreement total"}
          </span>
        </div>
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
            ? "Publish reviewed choices"
            : "Prepare signing, not signed."}
        </strong>
        <p>
          {content.commercialOffer
            ? "Publishing retains these terms and prepares exact signing documents for fixed choices. Client proposals need your approval before signing."
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
            ? "Publish payment offer"
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
