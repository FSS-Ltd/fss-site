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
  ensureClientProposedRecurringService,
  linesForAgreementDraft,
  toEditableLine,
  toEditableInstallment,
  parseInstallments,
  feeTotal,
  monthlyRecurringLine,
  separateOneOffFeeLines,
} from "./agreement-builder-fee-inputs";

type FeeLineState = Readonly<{
  includeOneOffFees: boolean;
  lines: EditableLine[];
  suspendedOneOffLines: EditableLine[];
}>;

export function AgreementBuilderFeesStep({
  agreement,
  content,
  onSave,
  pending,
}: BuilderStepProps): React.JSX.Element {
  const currency = agreement.currency ?? "GBP";
  const initialSpec: CommercialOfferSpec = content.commercialOffer?.spec ?? {
    cash: { mode: "fixed" },
    revenueShare: null,
  };
  const [spec, setSpec] = useState<CommercialOfferSpec>(initialSpec);
  const [feeLines, setFeeLines] = useState<FeeLineState>(() => {
    const includeOneOffFees = Boolean(
      agreement.lines?.some((line) => line.recurrenceMonths === 0),
    );
    const initialLines = agreement.lines?.length
      ? agreement.lines.map(toEditableLine)
      : [includeOneOffFees ? emptyLine() : monthlyRecurringLine()];
    const lines =
      initialSpec.cash?.mode === "client_proposed"
        ? ensureClientProposedRecurringService(initialLines)
        : initialLines;
    return {
      includeOneOffFees,
      lines,
      suspendedOneOffLines: [],
    };
  });
  const [installments, setInstallments] = useState<EditableInstallment[]>(() =>
    agreement.installments?.length
      ? agreement.installments.map(toEditableInstallment)
      : [],
  );
  const [formError, setFormError] = useState<string | null>(null);
  const { includeOneOffFees, lines } = feeLines;
  const flow = useAgreementBuilderGroups(includeOneOffFees ? 4 : 3);
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
    setFeeLines((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index
          ? ({ ...line, [field]: value } as EditableLine)
          : line,
      ),
    }));
  }

  function updateSpec(nextSpec: CommercialOfferSpec): void {
    setSpec(nextSpec);
    if (nextSpec.cash?.mode !== "client_proposed") return;
    setFeeLines((current) => {
      const activeLines = current.includeOneOffFees
        ? current.lines
        : [...current.lines, ...current.suspendedOneOffLines];
      const lines = ensureClientProposedRecurringService(activeLines);
      const { oneOff, recurring } = separateOneOffFeeLines(lines);
      return {
        includeOneOffFees: current.includeOneOffFees,
        lines: current.includeOneOffFees ? lines : recurring,
        suspendedOneOffLines: current.includeOneOffFees ? [] : oneOff,
      };
    });
  }

  function updateIncludeOneOffFees(include: boolean): void {
    setFeeLines((current) => {
      if (include) {
        const lines = [...current.suspendedOneOffLines, ...current.lines];
        return {
          includeOneOffFees: true,
          lines:
            current.suspendedOneOffLines.length === 0
              ? lines.some((line) => line.recurrenceMonths === "0")
                ? lines
                : [...lines, emptyLine()]
              : lines,
          suspendedOneOffLines: [],
        };
      }
      const { oneOff, recurring } = separateOneOffFeeLines(current.lines);
      return {
        includeOneOffFees: false,
        lines: recurring.length ? recurring : [monthlyRecurringLine()],
        suspendedOneOffLines: oneOff,
      };
    });
  }

  function addLine(): void {
    setFeeLines((current) => ({
      ...current,
      lines: [
        ...current.lines,
        spec.cash?.mode === "client_proposed" || !current.includeOneOffFees
          ? monthlyRecurringLine()
          : emptyLine(),
      ],
    }));
  }

  function removeLine(index: number): void {
    setFeeLines((current) => ({
      ...current,
      lines:
        current.lines.length === 1
          ? [
              spec.cash?.mode === "client_proposed" ||
              !current.includeOneOffFees
                ? monthlyRecurringLine()
                : emptyLine(),
            ]
          : current.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
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
    let invalidGroup = 0;
    const data = flow.read((groupIndex) => {
      invalidGroup = groupIndex;
    });
    if (!data) {
      if (invalidGroup >= 0)
        setFormError("Complete the highlighted field before saving fees.");
      return null;
    }
    let errorGroup = invalidGroup;
    try {
      setFormError(null);
      errorGroup = 1;
      const offer = readCommercialOffer(data);
      errorGroup = 0;
      const clientProposed = spec.cash?.mode === "client_proposed";
      if (!offer && spec.cash?.mode !== "fixed") {
        errorGroup = 1;
        throw new Error("Choose ongoing compensation before saving fees.");
      }
      const parsedFeeLines = linesForAgreementDraft(
        lines,
        includeOneOffFees,
        clientProposed,
      );
      if (
        !parsedFeeLines.length ||
        (!includeOneOffFees &&
          !parsedFeeLines.some((line) => line.recurrenceMonths > 0)) ||
        (clientProposed &&
          !parsedFeeLines.some((line) => line.recurrenceMonths > 0))
      ) {
        errorGroup = 0;
        throw new Error(
          includeOneOffFees
            ? "Add at least one service fee before saving."
            : "Add at least one recurring service when no one-off fee is included.",
        );
      }
      errorGroup = includeOneOffFees ? 3 : 2;
      const nextInstallments = includeOneOffFees
        ? parseInstallments(installments)
        : [];
      errorGroup = 2;
      const nextContent = mergeContent(content, {
        ...agreement,
        assetsRequired: data.has("assetsRequired"),
        currency,
        installments: nextInstallments,
        lines: parsedFeeLines,
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

  const groups = [
    {
      title: "Price the services",
      description: `Enter service amounts in ${currency}.`,
      children: (
        <AgreementBuilderFeeLines
          currency={currency}
          clientProposed={spec.cash?.mode === "client_proposed"}
          fixed={spec.cash?.mode === "fixed"}
          includeOneOffFees={includeOneOffFees}
          lines={lines}
          onAdd={addLine}
          onIncludeOneOffFeesChange={updateIncludeOneOffFees}
          onRemove={removeLine}
          total={total}
          updateLine={updateLine}
        />
      ),
    },
    {
      title: "Set ongoing compensation",
      children: (
        <CommercialOfferFields
          currency={currency}
          expiresAt={content.commercialOffer?.expiresAt}
          onChange={updateSpec}
          spec={spec}
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
    ...(includeOneOffFees
      ? [
          {
            title: "Plan the payments",
            children: (
              <AgreementBuilderPaymentSchedule
                currency={currency}
                installments={installments}
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
                updateInstallment={updateInstallment}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <AgreementBuilderGroupForm
      flow={flow}
      pending={pending}
      backLabel="Back to scope"
      onBack={() => void save("scope")}
      continueLabel="Continue to people"
      onContinue={() => void save("people")}
      onSave={() => void save("fees")}
      groups={groups}
    >
      {formError ? (
        <Notice tone="error">
          <p>{formError}</p>
        </Notice>
      ) : null}
    </AgreementBuilderGroupForm>
  );
}
