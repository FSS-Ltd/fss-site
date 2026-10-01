"use client";

import { useMemo, useRef, useState } from "react";
import { ReceiptPoundSterling } from "lucide-react";
import {
  Notice,
  PortalButton,
  PortalCheckbox,
  PortalField,
  PortalSelect,
} from "@/components/portal/ui";
import {
  decimalToMinor,
  minorToDecimal,
  currencySymbol,
} from "@/lib/operations/money";
import {
  CommercialOfferFields,
  readCommercialOffer,
} from "./commercial-offer-fields";
import type { CommercialOfferSpec } from "@/lib/operations/agreements/commercial-types";
import type { AgreementLine } from "@/lib/operations/agreements/types";
import { totalLinePence } from "@/lib/operations/agreements/validation";
import {
  BuilderSection,
  type BuilderAgreement,
  type BuilderStepProps,
  FormActions,
  formatGbp,
  mergeContent,
  numberValue,
  textValue,
} from "./agreement-builder-step-support";
import styles from "./agreements.module.css";

type EditableLine = Readonly<{
  description: string;
  discount: string;
  endDate: string;
  quantity: string;
  recurrenceMonths: "0" | "1" | "3" | "12";
  serviceCode: string;
  startDate: string;
  tax: string;
  unitPrice: string;
}>;

type EditableInstallment = Readonly<{ amount: string; dueDate: string }>;

function emptyLine(): EditableLine {
  return {
    description: "",
    discount: "0.00",
    endDate: "",
    quantity: "1",
    recurrenceMonths: "0",
    serviceCode: "",
    startDate: "",
    tax: "0.00",
    unitPrice: "",
  };
}

function toEditableLine(line: AgreementLine): EditableLine {
  return {
    description: line.description,
    discount: minorToDecimal(line.discountPence),
    endDate: line.endDate ?? "",
    quantity: String(line.quantity),
    recurrenceMonths: String(
      line.recurrenceMonths,
    ) as EditableLine["recurrenceMonths"],
    serviceCode: line.serviceCode,
    startDate: line.startDate,
    tax: minorToDecimal(line.taxPence),
    unitPrice: minorToDecimal(line.unitPence),
  };
}

function toEditableInstallment(
  installment: NonNullable<BuilderAgreement["installments"]>[number],
): EditableInstallment {
  return {
    amount: minorToDecimal(installment.amountPence),
    dueDate: installment.dueDate,
  };
}

function parseFeeLines(lines: readonly EditableLine[]): AgreementLine[] {
  return lines.map((line) => ({
    description: line.description.trim(),
    discountPence: decimalToMinor(line.discount),
    endDate: line.endDate || null,
    quantity: Number(line.quantity),
    recurrenceMonths: Number(
      line.recurrenceMonths,
    ) as AgreementLine["recurrenceMonths"],
    serviceCode: line.serviceCode.trim(),
    startDate: line.startDate,
    taxPence: decimalToMinor(line.tax),
    unitPence: decimalToMinor(line.unitPrice),
  }));
}

function parseInstallments(
  installments: readonly EditableInstallment[],
): NonNullable<BuilderAgreement["installments"]> {
  return installments.map((installment) => ({
    amountPence: decimalToMinor(installment.amount),
    dueDate: installment.dueDate,
  }));
}

function feeTotal(lines: readonly EditableLine[]): string | null {
  try {
    return lines
      .reduce(
        (total, line) =>
          total + BigInt(totalLinePence(parseFeeLines([line])[0])),
        BigInt(0),
      )
      .toString();
  } catch {
    return null;
  }
}

export function AgreementBuilderFeesStep({
  agreement,
  content,
  onSave,
  pending,
}: BuilderStepProps): React.JSX.Element {
  const formRef = useRef<HTMLFormElement>(null);
  const currency = agreement.currency ?? "GBP";
  const symbol = currencySymbol(currency);
  const [spec, setSpec] = useState<CommercialOfferSpec>(
    content.commercialOffer?.spec ?? {
      cash: { mode: "fixed" },
      revenueShare: null,
    },
  );
  const [lines, setLines] = useState<EditableLine[]>(() =>
    agreement.lines?.length
      ? agreement.lines.map(toEditableLine)
      : [emptyLine()],
  );
  const [installments, setInstallments] = useState<EditableInstallment[]>(() =>
    agreement.installments?.length
      ? agreement.installments.map(toEditableInstallment)
      : [],
  );
  const [formError, setFormError] = useState<string | null>(null);
  const total = useMemo(
    () =>
      feeTotal(
        lines.filter(
          (line) =>
            line.recurrenceMonths === "0" || spec.cash?.mode === "fixed",
        ),
      ),
    [lines, spec.cash?.mode],
  );

  function updateLine(
    index: number,
    field: keyof EditableLine,
    value: string,
  ): void {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index
          ? ({ ...line, [field]: value } as EditableLine)
          : line,
      ),
    );
  }

  function updateInstallment(
    index: number,
    field: keyof EditableInstallment,
    value: string,
  ): void {
    setInstallments((current) =>
      current.map((installment, installmentIndex) =>
        installmentIndex === index
          ? ({ ...installment, [field]: value } as EditableInstallment)
          : installment,
      ),
    );
  }

  function contentFromForm() {
    const form = formRef.current;
    if (!form || !form.reportValidity()) return null;
    const data = new FormData(form);
    try {
      setFormError(null);
      const offer = readCommercialOffer(data);
      const feeLines = parseFeeLines(
        lines.map((line) =>
          line.recurrenceMonths !== "0" && spec.cash?.mode !== "fixed"
            ? { ...line, unitPrice: "0", discount: "0", tax: "0" }
            : line,
        ),
      );
      const nextContent = mergeContent(content, {
        ...agreement,
        assetsRequired: data.has("assetsRequired"),
        currency,
        installments: parseInstallments(installments),
        lines: feeLines,
        minimumTermMonths: numberValue(data, "minimumTermMonths"),
        noticeDays: numberValue(data, "noticeDays"),
        requiredDepositPence: decimalToMinor(
          textValue(data, "requiredDeposit"),
        ),
        taxTreatment: textValue(data, "taxTreatment"),
      });
      return { ...nextContent, commercialOffer: offer };
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Complete each amount before saving fees.",
      );
      return null;
    }
  }

  async function save(step: "fees" | "people" | "scope"): Promise<void> {
    const nextContent = contentFromForm();
    if (nextContent) await onSave(step, nextContent);
  }

  return (
    <BuilderSection
      icon={<ReceiptPoundSterling size={20} />}
      title="Fees, schedule and terms"
    >
      <p className={styles.muted}>
        All amounts are entered and displayed in {currency}.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save("people");
        }}
        ref={formRef}
      >
        <fieldset className={styles.feeFieldset}>
          <legend>One-off fees and service lines</legend>
          <div className={styles.feeLineList}>
            {lines.map((line, index) => (
              <section className={styles.feeLine} key={index}>
                <div className={styles.feeLineHeading}>
                  <h3>Fee line {index + 1}</h3>
                  {lines.length > 1 ? (
                    <PortalButton
                      onClick={() =>
                        setLines((current) =>
                          current.filter((_, lineIndex) => lineIndex !== index),
                        )
                      }
                      type="button"
                      variant="quiet"
                    >
                      Remove line
                    </PortalButton>
                  ) : null}
                </div>
                <div className={styles.fieldGrid}>
                  <PortalField label="Service code" required>
                    <input
                      onChange={(event) =>
                        updateLine(index, "serviceCode", event.target.value)
                      }
                      value={line.serviceCode}
                    />
                  </PortalField>
                  <PortalField label="Description" required>
                    <input
                      onChange={(event) =>
                        updateLine(index, "description", event.target.value)
                      }
                      value={line.description}
                    />
                  </PortalField>
                  <PortalField label="Quantity" required>
                    <input
                      min="1"
                      onChange={(event) =>
                        updateLine(index, "quantity", event.target.value)
                      }
                      type="number"
                      value={line.quantity}
                    />
                  </PortalField>
                  <PortalField
                    label={`Rate (${symbol})`}
                    required={
                      line.recurrenceMonths === "0" ||
                      spec.cash?.mode === "fixed"
                    }
                  >
                    <input
                      disabled={
                        line.recurrenceMonths !== "0" &&
                        spec.cash?.mode !== "fixed"
                      }
                      inputMode="decimal"
                      onChange={(event) =>
                        updateLine(index, "unitPrice", event.target.value)
                      }
                      value={line.unitPrice}
                    />
                  </PortalField>
                  <PortalField label={`Discount (${symbol})`} required>
                    <input
                      disabled={
                        line.recurrenceMonths !== "0" &&
                        spec.cash?.mode !== "fixed"
                      }
                      inputMode="decimal"
                      onChange={(event) =>
                        updateLine(index, "discount", event.target.value)
                      }
                      value={line.discount}
                    />
                  </PortalField>
                  <PortalField label={`Tax amount (${symbol})`} required>
                    <input
                      disabled={
                        line.recurrenceMonths !== "0" &&
                        spec.cash?.mode !== "fixed"
                      }
                      inputMode="decimal"
                      onChange={(event) =>
                        updateLine(index, "tax", event.target.value)
                      }
                      value={line.tax}
                    />
                  </PortalField>
                  <PortalSelect
                    label="Billing interval"
                    onChange={(event) =>
                      updateLine(index, "recurrenceMonths", event.target.value)
                    }
                    value={line.recurrenceMonths}
                  >
                    <option value="0">One-off</option>
                    <option value="1">Monthly</option>
                    <option value="3">Quarterly</option>
                    <option value="12">Annual</option>
                  </PortalSelect>
                  <PortalField label="Contract start date" required>
                    <input
                      onChange={(event) =>
                        updateLine(index, "startDate", event.target.value)
                      }
                      type="date"
                      value={line.startDate}
                    />
                  </PortalField>
                  <PortalField label="Contract end date">
                    <input
                      onChange={(event) =>
                        updateLine(index, "endDate", event.target.value)
                      }
                      type="date"
                      value={line.endDate}
                    />
                  </PortalField>
                </div>
              </section>
            ))}
          </div>
          <PortalButton
            disabled={lines.length >= 30}
            onClick={() => setLines((current) => [...current, emptyLine()])}
            type="button"
            variant="secondary"
          >
            Add line item
          </PortalButton>
          <p className={styles.totalLine}>
            Priced service fees{" "}
            <strong>
              {total ? formatGbp(total, currency) : "Complete fee lines"}
            </strong>
          </p>
        </fieldset>
        <CommercialOfferFields
          spec={spec}
          currency={currency}
          expiresAt={content.commercialOffer?.expiresAt}
          onChange={setSpec}
        />
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
                onClick={() =>
                  setInstallments((current) =>
                    current.filter(
                      (_, installmentIndex) => installmentIndex !== index,
                    ),
                  )
                }
                type="button"
                variant="quiet"
              >
                Remove installment
              </PortalButton>
            </div>
          ))}
          <PortalButton
            disabled={installments.length >= 30}
            onClick={() =>
              setInstallments((current) => [
                ...current,
                { amount: "", dueDate: "" },
              ])
            }
            type="button"
            variant="secondary"
          >
            Add installment
          </PortalButton>
        </fieldset>
        <PortalCheckbox
          defaultChecked={agreement.assetsRequired ?? false}
          label="Client assets are required before service starts"
          name="assetsRequired"
        />
        {formError ? (
          <Notice tone="error">
            <p>{formError}</p>
          </Notice>
        ) : null}
        <Notice tone="info">
          <strong>Validation happens before an agreement is created.</strong>
          <p>
            Payment amounts must reconcile and recurring lines need a cadence
            and start policy.
          </p>
        </Notice>
        <FormActions
          backLabel="Back to scope"
          continueLabel="Continue to people"
          onBack={() => void save("scope")}
          onSave={() => void save("fees")}
          pending={pending}
        />
      </form>
    </BuilderSection>
  );
}
