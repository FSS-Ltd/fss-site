import {
  PortalButton,
  PortalCheckbox,
  PortalField,
} from "@/components/portal/ui";
import {
  currencySymbol,
  minorToDecimal,
  type Currency,
} from "@/lib/operations/money";
import type { BuilderAgreement } from "./agreement-builder-step-support";
import type { EditableInstallment } from "./agreement-builder-fee-inputs";
import styles from "./agreements.module.css";

export function AgreementBuilderPaymentTerms({
  agreement,
  currency,
}: Readonly<{
  agreement: BuilderAgreement;
  currency: Currency;
}>): React.JSX.Element {
  const symbol = currencySymbol(currency);
  return (
    <>
      <fieldset className={styles.feeFieldset}>
        <legend>Payment terms</legend>
        <div className={styles.fieldGrid}>
          <PortalField label="Tax treatment" required>
            <input
              defaultValue={agreement.taxTreatment ?? ""}
              name="taxTreatment"
            />
          </PortalField>
          <PortalField label={`Required deposit (${symbol})`} required>
            <input
              defaultValue={
                agreement.requiredDepositPence
                  ? minorToDecimal(agreement.requiredDepositPence)
                  : "0.00"
              }
              inputMode="decimal"
              name="requiredDeposit"
            />
          </PortalField>
          <PortalField label="Minimum term (months)" required>
            <input
              defaultValue={agreement.minimumTermMonths ?? 0}
              max="120"
              min="0"
              name="minimumTermMonths"
              type="number"
            />
          </PortalField>
          <PortalField label="Notice period (days)" required>
            <input
              defaultValue={agreement.noticeDays ?? 0}
              max="3650"
              min="0"
              name="noticeDays"
              type="number"
            />
          </PortalField>
        </div>
        <p className={styles.muted}>
          Select the applicable reviewed tax policy. FSS Studio does not infer
          tax, deposits or late fees.
        </p>
      </fieldset>
      <PortalCheckbox
        defaultChecked={agreement.assetsRequired ?? false}
        label="Client assets are required before service starts"
        name="assetsRequired"
      />
    </>
  );
}

export function AgreementBuilderPaymentSchedule({
  installments,
  currency,
  updateInstallment,
  onAdd,
  onRemove,
}: Readonly<{
  installments: readonly EditableInstallment[];
  currency: Currency;
  updateInstallment: (
    index: number,
    field: keyof EditableInstallment,
    value: string,
  ) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}>): React.JSX.Element {
  const symbol = currencySymbol(currency);
  return (
    <fieldset className={styles.feeFieldset}>
      <legend>One-off payment schedule</legend>
      <p className={styles.muted}>
        Installments must allocate the exact one-off total including tax.
        Recurring-only agreements do not need installments.
      </p>
      {installments.map((installment, index) => (
        <div className={styles.fieldGrid} key={index}>
          <PortalField label={`Installment ${index + 1} due date`} required>
            <input
              onChange={(event) =>
                updateInstallment(index, "dueDate", event.target.value)
              }
              type="date"
              value={installment.dueDate}
            />
          </PortalField>
          <PortalField
            label={`Installment ${index + 1} amount (${symbol})`}
            required
          >
            <input
              inputMode="decimal"
              onChange={(event) =>
                updateInstallment(index, "amount", event.target.value)
              }
              value={installment.amount}
            />
          </PortalField>
          <PortalButton
            onClick={() => onRemove(index)}
            type="button"
            variant="quiet"
          >
            Remove installment
          </PortalButton>
        </div>
      ))}
      <PortalButton
        disabled={installments.length >= 30}
        onClick={() => onAdd()}
        type="button"
        variant="secondary"
      >
        Add installment
      </PortalButton>
    </fieldset>
  );
}
