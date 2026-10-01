import { decimalToMinor, minorToDecimal } from "@/lib/operations/money";
import type { AgreementLine } from "@/lib/operations/agreements/types";
import { totalLinePence } from "@/lib/operations/agreements/validation";
import type { BuilderAgreement } from "./agreement-builder-step-support";

export type EditableLine = Readonly<{
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

export type EditableInstallment = Readonly<{ amount: string; dueDate: string }>;

export function emptyLine(): EditableLine {
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
