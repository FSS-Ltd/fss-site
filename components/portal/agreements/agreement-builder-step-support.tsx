import { ArrowLeft, ArrowRight } from "lucide-react";
import { PortalButton, PortalCard } from "@/components/portal/ui";
import type {
  AgreementBuilderDraftContent,
  AgreementBuilderStep,
} from "@/lib/operations/agreements/builder-draft-schema";
import { formatMoney, type Currency } from "@/lib/operations/money";
import styles from "./agreements.module.css";

export type BuilderAgreement = NonNullable<
  AgreementBuilderDraftContent["agreement"]
>;

export type BuilderStepProps = Readonly<{
  agreement: BuilderAgreement;
  content: AgreementBuilderDraftContent;
  onSave: (
    step: AgreementBuilderStep,
    content: AgreementBuilderDraftContent,
  ) => Promise<void>;
  onBeginEngagement?: (content: AgreementBuilderDraftContent) => Promise<void>;
  pending: boolean;
}>;

export function textValue(data: FormData, name: string): string {
  return String(data.get(name) ?? "").trim();
}

export function numberValue(data: FormData, name: string): number {
  return Number(textValue(data, name));
}

export function mergeContent(
  content: AgreementBuilderDraftContent,
  agreement: BuilderAgreement,
  engagementId: string | undefined = content.engagementId,
): AgreementBuilderDraftContent {
  return {
    ...content,
    agreement,
    ...(engagementId ? { engagementId } : {}),
  };
}

export function formatGbp(
  pence: string | undefined,
  currency: Currency = "GBP",
): string {
  if (!pence) return formatMoney("0", currency);
  try {
    return formatMoney(pence, currency);
  } catch {
    return formatMoney("0", currency);
  }
}

export function FormActions({
  backLabel,
  continueDisabled = false,
  continueDisabledReason,
  continueLabel,
  onBack,
  onSave,
  pending,
}: Readonly<{
  backLabel?: string;
  continueDisabled?: boolean;
  continueDisabledReason?: string;
  continueLabel: string;
  onBack?: () => void;
  onSave: () => void;
  pending: boolean;
}>): React.JSX.Element {
  return (
    <div className={styles.actionRow}>
      {onBack ? (
        <PortalButton
          disabled={pending}
          onClick={onBack}
          type="button"
          variant="secondary"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          {backLabel ?? "Back"}
        </PortalButton>
      ) : null}
      <PortalButton
        disabled={pending || continueDisabled}
        disabledReason={continueDisabled ? continueDisabledReason : undefined}
        loading={pending}
        type="submit"
      >
        {continueLabel}
        <ArrowRight aria-hidden="true" size={16} />
      </PortalButton>
      <PortalButton
        disabled={pending}
        onClick={onSave}
        type="button"
        variant="quiet"
      >
        Save draft
      </PortalButton>
    </div>
  );
}

export function BuilderSection({
  children,
  icon,
  title,
}: Readonly<{
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}>): React.JSX.Element {
  return (
    <PortalCard className={styles.builderCard}>
      <div className={styles.builderCardHeading}>
        <span aria-hidden="true" className={styles.builderIcon}>
          {icon}
        </span>
        <h2>{title}</h2>
      </div>
      {children}
    </PortalCard>
  );
}
