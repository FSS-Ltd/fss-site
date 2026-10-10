import { decimalToMinor, minorToDecimal } from "@/lib/operations/money";
import type { AgreementLine } from "@/lib/operations/agreements/types";
import { totalLinePence } from "@/lib/operations/agreements/validation";
import type { BuilderAgreement } from "./agreement-builder-step-support";
import type { AgreementBuilderDraftContent } from "@/lib/operations/agreements/builder-draft-schema";

export type EditableLine = Readonly<{
  description: string;
  discount: string;
  endDate: string;
  quantity: string;
  recurrenceMonths: "0" | "1" | "3" | "12";
  serviceCode: string;
  serviceGroupId?: string;
  startDate: string;
  tax: string;
  unitPrice: string;
}>;

export type EditableInstallment = Readonly<{ amount: string; dueDate: string }>;

export function emptyLine(serviceGroupId?: string): EditableLine {
  return {
    description: "",
    discount: "0.00",
    endDate: "",
    quantity: "1",
    recurrenceMonths: "0",
    serviceCode: "",
    ...(serviceGroupId ? { serviceGroupId } : {}),
    startDate: "",
    tax: "0.00",
    unitPrice: "",
  };
}

export function monthlyRecurringLine(serviceGroupId?: string): EditableLine {
  return { ...emptyLine(serviceGroupId), recurrenceMonths: "1" };
}

function isUntouchedStarterLine(line: EditableLine): boolean {
  const { serviceGroupId: _groupId, ...fee } = line;
  void _groupId;
  return JSON.stringify(fee) === JSON.stringify(emptyLine());
}

export function ensureClientProposedRecurringService(
  lines: readonly EditableLine[],
): EditableLine[] {
  if (lines.length === 0) return [monthlyRecurringLine()];
  if (lines.some((line) => line.recurrenceMonths !== "0"))
    return lines.map((line) => ({ ...line }));
  if (lines.length === 1 && isUntouchedStarterLine(lines[0]))
    return [monthlyRecurringLine()];
  return [...lines, monthlyRecurringLine()];
}

export function separateOneOffFeeLines(
  lines: readonly EditableLine[],
): Readonly<{ oneOff: EditableLine[]; recurring: EditableLine[] }> {
  return {
    oneOff: lines.filter((line) => line.recurrenceMonths === "0"),
    recurring: lines.filter((line) => line.recurrenceMonths !== "0"),
  };
}

export function linesForAgreementDraft(
  lines: readonly EditableLine[],
  includeOneOffFees: boolean,
  clientProposed: boolean,
  services?: AgreementBuilderDraftContent["services"],
): AgreementLine[] {
  const activeLines = lines.filter(
    (line) => includeOneOffFees || line.recurrenceMonths !== "0",
  );
  const parsed = parseFeeLines(
    activeLines.map((line) =>
      line.recurrenceMonths !== "0" && clientProposed
        ? { ...line, unitPrice: "0", discount: "0", tax: "0" }
        : line,
    ),
  );
  if (!services) return parsed;
  return parsed.map((line, index) => {
    const group = services.find(
      (item) => item.id === activeLines[index].serviceGroupId,
    );
    if (!group) throw new Error("Assign every fee line to a service.");
    return {
      ...line,
      serviceCode: group.code.trim(),
      description: `${group.name.trim()}: ${group.description.trim()}`,
    };
  });
}

export function toEditableLine(line: AgreementLine): EditableLine {
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

export function toEditableInstallment(
  installment: NonNullable<BuilderAgreement["installments"]>[number],
): EditableInstallment {
  return {
    amount: minorToDecimal(installment.amountPence),
    dueDate: installment.dueDate,
  };
}

export function parseFeeLines(lines: readonly EditableLine[]): AgreementLine[] {
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

export function parseInstallments(
  installments: readonly EditableInstallment[],
): NonNullable<BuilderAgreement["installments"]> {
  return installments.map((installment) => ({
    amountPence: decimalToMinor(installment.amount),
    dueDate: installment.dueDate,
  }));
}

export function feeTotal(lines: readonly EditableLine[]): string | null {
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
