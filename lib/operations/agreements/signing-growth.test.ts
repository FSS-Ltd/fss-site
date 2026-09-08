import assert from "node:assert/strict";
import test from "node:test";
import { agreementDraft } from "./fixtures";
import { signingGrowthValues } from "./signing-growth";
test("Growth signing projection excludes tax and normalises recurring net pence exactly", () => {
  const draft = agreementDraft();
  draft.lines.push({
    ...draft.lines[0],
    unitPence: "12000",
    discountPence: "0",
    recurrenceMonths: 12,
  });
  draft.lines.push({
    ...draft.lines[0],
    unitPence: "3300",
    discountPence: "300",
    recurrenceMonths: 3,
  });
  assert.deepEqual(signingGrowthValues(draft), {
    oneOffValuePence: 10000,
    monthlyValuePence: 2000,
  });
});
test("Growth signing projection refuses malformed, fractional, zero and unsafe values", () => {
  assert.equal(signingGrowthValues({}), null);
  const draft = agreementDraft();
  draft.lines.push({
    ...draft.lines[0],
    unitPence: "1000",
    recurrenceMonths: 12,
  });
  assert.equal(signingGrowthValues(draft), null);
  const zero = agreementDraft();
  zero.lines = [{ ...zero.lines[0], unitPence: "0", taxPence: "0" }];
  zero.installments = [];
  assert.equal(signingGrowthValues(zero), null);
  const unsafe = agreementDraft();
  unsafe.lines = [
    { ...unsafe.lines[0], unitPence: "999999999999999999", taxPence: "0" },
  ];
  unsafe.installments = [
    { dueDate: "2026-10-01", amountPence: "999999999999999999" },
  ];
  assert.equal(signingGrowthValues(unsafe), null);
});
