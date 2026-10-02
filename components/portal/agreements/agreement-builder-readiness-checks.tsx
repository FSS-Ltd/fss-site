"use client";

import { CheckCircle2 } from "lucide-react";
import { Notice, PortalButton, PortalCard } from "@/components/portal/ui";
import type { AgreementBuilderReadiness } from "@/lib/operations/agreements/builder-draft-validation";
import type { AgreementBuilderStep } from "@/lib/operations/agreements/builder-draft-schema";
import styles from "./agreements.module.css";

export function AgreementBuilderReadinessChecks({
  readiness,
  engagementLinked,
  signerCount,
  pending,
  onRepair,
}: Readonly<{
  readiness: AgreementBuilderReadiness;
  engagementLinked: boolean;
  signerCount: number;
  pending: boolean;
  onRepair: (step: AgreementBuilderStep) => Promise<void>;
}>): React.JSX.Element {
  return (
    <PortalCard title="Readiness checks">
      {readiness.success ? (
        <ul className={styles.checkList}>
          <li>
            <CheckCircle2 aria-hidden="true" size={18} />{" "}
            <span>Engagement linked</span>
            <strong>{engagementLinked ? "Ready" : "Required"}</strong>
          </li>
          <li>
            <CheckCircle2 aria-hidden="true" size={18} />{" "}
            <span>Fees and schedule reconcile</span>
            <strong>Validated on creation</strong>
          </li>
          <li>
            <CheckCircle2 aria-hidden="true" size={18} />{" "}
            <span>Signers and access reviewed</span>
            <strong>{signerCount} selected</strong>
          </li>
          <li>
            <CheckCircle2 aria-hidden="true" size={18} />{" "}
            <span>Document preview reviewed</span>
            <strong>Prepared from draft</strong>
          </li>
        </ul>
      ) : (
        <Notice tone="error">
          <strong>Complete these details before sending</strong>
          <ul>
            {readiness.issues.map((issue) => (
              <li key={issue.message}>{issue.message}</li>
            ))}
          </ul>
          <div className={styles.actionRow}>
            {[...new Set(readiness.issues.map((issue) => issue.step))].map(
              (step) => (
                <PortalButton
                  key={step}
                  disabled={pending}
                  onClick={() => void onRepair(step)}
                  type="button"
                  variant="secondary"
                >
                  Edit {step === "link" ? "work" : step}
                </PortalButton>
              ),
            )}
          </div>
        </Notice>
      )}
    </PortalCard>
  );
}
