"use client";

import { useMemo } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Notice, PortalButton, PortalCard } from "@/components/portal/ui";
import { totalLinePence } from "@/lib/operations/agreements/validation";
import {
  BuilderSection,
  type BuilderStepProps,
  formatGbp,
} from "./agreement-builder-step-support";
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
      <PortalCard title="Readiness checks">
        <ul className={styles.checkList}>
          <li>
            <CheckCircle2 aria-hidden="true" size={18} />{" "}
            <span>Engagement linked</span>
            <strong>{content.engagementId ? "Ready" : "Required"}</strong>
          </li>
          <li>
            <CheckCircle2 aria-hidden="true" size={18} />{" "}
            <span>Fees and schedule reconcile</span>
            <strong>Validated on creation</strong>
          </li>
          <li>
            <CheckCircle2 aria-hidden="true" size={18} />{" "}
            <span>Signers and access reviewed</span>
            <strong>{agreement.signatories?.length ?? 0} selected</strong>
          </li>
          <li>
            <CheckCircle2 aria-hidden="true" size={18} />{" "}
            <span>Document preview reviewed</span>
            <strong>Prepared from draft</strong>
          </li>
        </ul>
      </PortalCard>
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
          disabled={!draftExists || pending}
          disabledReason={
            !draftExists
              ? "Save this review before creating the agreement record."
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
