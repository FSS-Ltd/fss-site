"use client";

import { useMemo, useState } from "react";
import { Notice } from "@/components/portal/ui";
import { decimalToMinor } from "@/lib/operations/money";
import type { AgreementBuilderDraftContent } from "@/lib/operations/agreements/builder-draft-schema";
import {
  CommercialOfferFields,
  readCommercialOffer,
} from "./commercial-offer-fields";
import type { CommercialOfferSpec } from "@/lib/operations/agreements/commercial-types";
import {
  type BuilderStepProps,
  mergeContent,
  numberValue,
  textValue,
} from "./agreement-builder-step-support";
import {
  AgreementBuilderGroupForm,
  useAgreementBuilderGroups,
} from "./agreement-builder-groups";
import { AgreementBuilderFeeLines } from "./agreement-builder-fee-lines";
import {
  AgreementBuilderPaymentTerms,
  AgreementBuilderPaymentSchedule,
} from "./agreement-builder-payment-fields";
import {
  type EditableLine,
  type EditableInstallment,
  emptyLine,
  toEditableLine,
  toEditableInstallment,
  parseFeeLines,
  parseInstallments,
  feeTotal,
} from "./agreement-builder-fee-inputs";

export function AgreementBuilderFeesStep({
  agreement,
  content,
  onSave,
  pending,
}: BuilderStepProps): React.JSX.Element {
  const flow = useAgreementBuilderGroups(4);
  const currency = agreement.currency ?? "GBP";
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

  function contentFromForm(): AgreementBuilderDraftContent | null {
    const data = flow.read();
    if (!data) return null;
    let errorGroup = 1;
    try {
      setFormError(null);
      const offer = readCommercialOffer(data);
      errorGroup = 0;
      const feeLines = parseFeeLines(
        lines.map((line) =>
          line.recurrenceMonths !== "0" && spec.cash?.mode !== "fixed"
            ? { ...line, unitPrice: "0", discount: "0", tax: "0" }
            : line,
        ),
      );
      errorGroup = 3;
      const nextInstallments = parseInstallments(installments);
      errorGroup = 2;
      const nextContent = mergeContent(content, {
        ...agreement,
        assetsRequired: data.has("assetsRequired"),
        currency,
        installments: nextInstallments,
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
      flow.show(errorGroup);
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
    <AgreementBuilderGroupForm
      flow={flow}
      pending={pending}
      backLabel="Back to scope"
      onBack={() => void save("scope")}
      continueLabel="Continue to people"
      onContinue={() => void save("people")}
      onSave={() => void save("fees")}
      groups={[
        {
          title: "Price the services",
          description: `Enter service amounts in ${currency}.`,
          children: (
            <AgreementBuilderFeeLines
              lines={lines}
              fixed={spec.cash?.mode === "fixed"}
              total={total}
              currency={currency}
              updateLine={updateLine}
              onAdd={() => setLines((current) => [...current, emptyLine()])}
              onRemove={(index) =>
                setLines((current) =>
                  current.filter((_, lineIndex) => lineIndex !== index),
                )
              }
            />
          ),
        },
        {
          title: "Set ongoing compensation",
          children: (
            <CommercialOfferFields
              spec={spec}
              currency={currency}
              expiresAt={content.commercialOffer?.expiresAt}
              onChange={setSpec}
            />
          ),
        },
        {
          title: "Set the payment terms",
          children: (
            <AgreementBuilderPaymentTerms
              agreement={agreement}
              currency={currency}
            />
          ),
        },
        {
          title: "Plan the payments",
          children: (
            <AgreementBuilderPaymentSchedule
              installments={installments}
              currency={currency}
              updateInstallment={updateInstallment}
              onAdd={() =>
                setInstallments((current) => [
                  ...current,
                  { amount: "", dueDate: "" },
                ])
              }
              onRemove={(index) =>
                setInstallments((current) =>
                  current.filter(
                    (_, installmentIndex) => installmentIndex !== index,
                  ),
                )
              }
            />
          ),
        },
      ]}
    >
      {formError ? (
        <Notice tone="error">
          <p>{formError}</p>
        </Notice>
      ) : null}
    </AgreementBuilderGroupForm>
  );
}
