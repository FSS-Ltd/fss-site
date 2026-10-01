import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  parseAgreementDraft,
  parseSignatureEvidence,
  totalLinePence,
} from "./validation";
import { agreementDraft, signatureEvidence } from "./fixtures";

test("agreement currency is restricted to GBP, USD and EUR", () => {
  for (const currency of ["GBP", "USD", "EUR"]) {
    assert.equal(
      parseAgreementDraft({ ...agreementDraft(), currency }).currency,
      currency,
    );
  }
  assert.throws(() =>
    parseAgreementDraft({ ...agreementDraft(), currency: "CAD" }),
  );
});

test("revenue share requires terms and cannot also charge ongoing cash", () => {
  const revenueShare = {
    percentageBps: 1000,
    revenueSource: "Product sales",
    calculationBasis: "Received revenue",
    duration: "24 months",
    reportingRequirements: "Monthly reports",
    paymentTerms: "Monthly within 14 days",
  };
  const draft = agreementDraft();
  const lines = [
    ...draft.lines,
    {
      ...draft.lines[0],
      recurrenceMonths: 1,
      unitPence: "0",
      discountPence: "0",
      taxPence: "0",
    },
  ];
  assert.equal(
    parseAgreementDraft({ ...draft, lines, revenueShare }).revenueShare
      ?.percentageBps,
    1000,
  );
  assert.throws(() =>
    parseAgreementDraft({
      ...draft,
      lines,
      revenueShare: { ...revenueShare, percentageBps: 10001 },
    }),
  );
  assert.throws(() =>
    parseAgreementDraft({
      ...draft,
      lines: [...draft.lines, { ...lines[1], unitPence: "20" }],
      revenueShare,
    }),
  );
});

test("one-off, quarterly and annual prices preserve exact pence and recurrence", () => {
  for (const recurrenceMonths of [0, 3, 12] as const) {
    const input = agreementDraft();
    input.lines[0].recurrenceMonths = recurrenceMonths;
    if (recurrenceMonths) input.installments = [];
    const draft = parseAgreementDraft(input);
    assert.equal(draft.lines[0].recurrenceMonths, recurrenceMonths);
    assert.equal(totalLinePence(draft.lines[0]), "12000");
  }
});
test("rejects invalid installment allocations, money, dates and missing document evidence", () => {
  const draft = agreementDraft();
  assert.throws(() =>
    parseAgreementDraft({
      ...draft,
      installments: [{ dueDate: "2026-10-01", amountPence: "1" }],
    }),
  );
  assert.throws(
    () =>
      parseAgreementDraft({
        ...draft,
        lines: [{ ...draft.lines[0], unitPence: "1.5" }],
      }),
    z.ZodError,
  );
  assert.throws(() =>
    parseAgreementDraft({
      ...draft,
      lines: [{ ...draft.lines[0], startDate: "2026-02-30" }],
    }),
  );
  assert.throws(() =>
    parseSignatureEvidence({ ...signatureEvidence(), confirmed: false }),
  );
  assert.throws(() =>
    parseSignatureEvidence({
      ...signatureEvidence(),
      documentReference: "https://public.test/file",
    }),
  );
  assert.throws(() =>
    parseSignatureEvidence({ ...signatureEvidence(), sourceHash: "" }),
  );
});
