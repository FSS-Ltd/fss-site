import type { AgreementDraft } from "../agreements/types";
import { penceToGbp } from "../agreements/money-input";
export function journeyTime(value: string | null): string {
  if (!value) return "Not scheduled";
  return (
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value)) + " London"
  );
}
export function invoiceChoices(
  draft: AgreementDraft,
): { value: string; label: string }[] {
  return [
    ...draft.installments.map((part, index) => ({
      value: `installment:${index + 1}`,
      label: `Installment ${index + 1}: £${penceToGbp(part.amountPence)} due ${part.dueDate}`,
    })),
    ...draft.lines.flatMap((line, index) =>
      line.recurrenceMonths > 0
        ? [
            {
              value: `line:${index + 1}`,
              label: `${line.description} · every ${line.recurrenceMonths} month(s)`,
            },
          ]
        : [],
    ),
  ];
}
