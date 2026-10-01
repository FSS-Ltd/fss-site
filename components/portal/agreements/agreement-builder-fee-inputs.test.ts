import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyLine,
  feeTotal,
  parseFeeLines,
  parseInstallments,
  toEditableInstallment,
  toEditableLine,
} from "./agreement-builder-fee-inputs";

test("service amounts round-trip without changing precision, dates or recurrence", () => {
  const [line] = parseFeeLines([
    {
      ...emptyLine(),
      description: " Support ",
      serviceCode: " support ",
      unitPrice: "123.45",
      quantity: "3",
      discount: "5.50",
      tax: "1.25",
      startDate: "2026-10-01",
      endDate: "2027-10-01",
      recurrenceMonths: "3",
    },
  ]);
  assert.equal(line.description, "Support");
  assert.equal(line.serviceCode, "support");
  assert.equal(line.unitPence, "12345");
  assert.equal(line.recurrenceMonths, 3);
  assert.deepEqual(toEditableLine(line), {
    ...emptyLine(),
    description: "Support",
    serviceCode: "support",
    unitPrice: "123.45",
    quantity: "3",
    discount: "5.50",
    tax: "1.25",
    startDate: "2026-10-01",
    endDate: "2027-10-01",
    recurrenceMonths: "3",
  });
  assert.equal(feeTotal([toEditableLine(line)]), "36610");
});

test("unpriced or malformed service amounts show an incomplete total", () => {
  assert.equal(feeTotal([emptyLine()]), null);
  assert.throws(() =>
    parseFeeLines([{ ...emptyLine(), unitPrice: "invalid" }]),
  );
});

test("installments preserve exact minor units and reject malformed amounts", () => {
  const input = { amount: "1200.01", dueDate: "2026-10-01" };
  const [installment] = parseInstallments([input]);
  assert.equal(installment.amountPence, "120001");
  assert.deepEqual(toEditableInstallment(installment), input);
  assert.throws(() => parseInstallments([{ ...input, amount: "invalid" }]));
});
