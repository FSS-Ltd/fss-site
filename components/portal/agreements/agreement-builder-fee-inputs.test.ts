import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyLine,
  ensureClientProposedRecurringService,
  feeTotal,
  linesForAgreementDraft,
  monthlyRecurringLine,
  parseFeeLines,
  parseInstallments,
  separateOneOffFeeLines,
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

test("client-proposed compensation converts an untouched starter to monthly and preserves entered one-off fees", () => {
  assert.deepEqual(ensureClientProposedRecurringService([emptyLine()]), [
    monthlyRecurringLine(),
  ]);
  assert.deepEqual(ensureClientProposedRecurringService([]), [
    monthlyRecurringLine(),
  ]);

  const setup = {
    ...emptyLine(),
    description: "Website setup",
    serviceCode: "website_setup",
    startDate: "2026-10-01",
    unitPrice: "1200.00",
  };
  const recurring = {
    ...monthlyRecurringLine(),
    recurrenceMonths: "3" as const,
    description: "Quarterly support",
  };
  const lines = ensureClientProposedRecurringService([setup, recurring]);
  assert.deepEqual(lines, [setup, recurring]);
  assert.deepEqual(ensureClientProposedRecurringService([setup]), [
    setup,
    monthlyRecurringLine(),
  ]);
});

test("one-off fees can be excluded from saved drafts and monthly client-proposed recurrence remains", () => {
  const oneOff = {
    ...emptyLine(),
    serviceCode: "setup",
    description: "Setup",
    startDate: "2026-10-01",
    unitPrice: "1200.00",
  };
  const recurring = {
    ...monthlyRecurringLine(),
    serviceCode: "support",
    description: "Support",
    startDate: "2026-10-01",
    unitPrice: "100.00",
  };
  assert.deepEqual(separateOneOffFeeLines([oneOff, recurring]), {
    oneOff: [oneOff],
    recurring: [recurring],
  });
  assert.deepEqual(linesForAgreementDraft([oneOff, recurring], false, false), [
    {
      serviceCode: "support",
      description: "Support",
      quantity: 1,
      unitPence: "10000",
      discountPence: "0",
      taxPence: "0",
      recurrenceMonths: 1,
      startDate: "2026-10-01",
      endDate: null,
    },
  ]);
});

test("client-proposed fees retain setup charges and save the service monthly at zero fixed price", () => {
  const setup = {
    ...emptyLine(),
    serviceCode: "setup",
    description: "Setup",
    startDate: "2026-10-01",
    unitPrice: "1200.00",
  };
  const service = {
    ...monthlyRecurringLine(),
    serviceCode: "support",
    description: "Support",
    startDate: "2026-10-01",
    unitPrice: "99.00",
    discount: "5.00",
    tax: "2.00",
  };
  assert.deepEqual(linesForAgreementDraft([setup, service], true, true), [
    {
      serviceCode: "setup",
      description: "Setup",
      quantity: 1,
      unitPence: "120000",
      discountPence: "0",
      taxPence: "0",
      recurrenceMonths: 0,
      startDate: "2026-10-01",
      endDate: null,
    },
    {
      serviceCode: "support",
      description: "Support",
      quantity: 1,
      unitPence: "0",
      discountPence: "0",
      taxPence: "0",
      recurrenceMonths: 1,
      startDate: "2026-10-01",
      endDate: null,
    },
  ]);
});

test("all-fee-line removal cannot produce an agreement without a recurring service", () => {
  assert.equal(
    linesForAgreementDraft([emptyLine()], false, true).some(
      (line) => line.recurrenceMonths > 0,
    ),
    false,
  );
});

test("installments preserve exact minor units and reject malformed amounts", () => {
  const input = { amount: "1200.01", dueDate: "2026-10-01" };
  const [installment] = parseInstallments([input]);
  assert.equal(installment.amountPence, "120001");
  assert.deepEqual(toEditableInstallment(installment), input);
  assert.throws(() => parseInstallments([{ ...input, amount: "invalid" }]));
});

test("setup and recurring charges retain one service identity", () => {
  const service = {
    id: "11111111-1111-4111-8111-111111111111",
    code: "website",
    name: "Website delivery",
    description: "Design, build and ongoing support",
  };
  const lines = [
    { ...emptyLine(service.id), unitPrice: "500.00", startDate: "2026-11-01" },
    {
      ...monthlyRecurringLine(service.id),
      unitPrice: "120.00",
      startDate: "2026-11-01",
    },
  ];
  const saved = linesForAgreementDraft(lines, true, false, [service]);
  assert.deepEqual(
    saved.map(({ serviceCode, description, recurrenceMonths }) => ({
      serviceCode,
      description,
      recurrenceMonths,
    })),
    [
      {
        serviceCode: "website",
        description: "Website delivery: Design, build and ongoing support",
        recurrenceMonths: 0,
      },
      {
        serviceCode: "website",
        description: "Website delivery: Design, build and ongoing support",
        recurrenceMonths: 1,
      },
    ],
  );
  assert.throws(
    () =>
      linesForAgreementDraft(
        [{ ...lines[0], serviceGroupId: undefined }],
        true,
        false,
        [service],
      ),
    /Assign every fee line/,
  );
});
