"use client";

import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { PortalButton, PortalCard } from "@/components/portal/ui";
import {
  BuilderSection,
  type BuilderStepProps,
} from "./agreement-builder-step-support";
import { AgreementBuilderSummary } from "./agreement-builder-summary";
import styles from "./agreements.module.css";

export function AgreementBuilderDocumentStep({
  agreement,
  content,
  onSave,
  pending,
}: BuilderStepProps): React.JSX.Element {
  return (
    <BuilderSection
      icon={<ShieldCheck size={20} />}
      title="Prepare the agreement document"
    >
      <p className={styles.muted}>
        Review the saved terms before creating the agreement.
      </p>
      <PortalCard
        className={`${styles.documentPreview} ${styles.documentPreviewDark}`}
        tone="dark"
      >
        <p className={styles.version}>FSS Studio / Agreement draft</p>
        <h3>{agreement.title || "Untitled agreement"}</h3>
        <AgreementBuilderSummary
          agreement={agreement}
          commercialOffer={content.commercialOffer}
        />
      </PortalCard>
      <p className={styles.muted}>
        The signing document is prepared on the agreement record after creation.
      </p>
      <div className={styles.actionRow}>
        <PortalButton
          disabled={pending}
          onClick={() => void onSave("people", content)}
          type="button"
          variant="secondary"
        >
          <ArrowLeft aria-hidden="true" size={16} /> Back to people
        </PortalButton>
        <PortalButton
          disabled={pending}
          loading={pending}
          onClick={() => void onSave("review", content)}
          type="button"
        >
          Review agreement <ArrowRight aria-hidden="true" size={16} />
        </PortalButton>
        <PortalButton
          disabled={pending}
          onClick={() => void onSave("document", content)}
          type="button"
          variant="quiet"
        >
          Save draft
        </PortalButton>
      </div>
    </BuilderSection>
  );
}
