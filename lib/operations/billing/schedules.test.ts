import assert from "node:assert/strict";
import test from "node:test";
import { agreementDraft } from "../agreements/fixtures";
import { deriveBillingObligations } from "./schedules";

test("deposit installments allocate one-off total without duplicating required deposit and later retainer", () => {
  const draft = agreementDraft();
  draft.lines.push({
    ...draft.lines[0],
    recurrenceMonths: 1,
    startDate: "2026-12-01",
  });
  const obligations = deriveBillingObligations(draft, "2026-09-06");
  assert.deepEqual(
    obligations.map((o) => [o.key, o.amountPence, o.owner, o.dueDate]),
    [
      ["installment:1", "6000", "invoice", "2026-10-01"],
      ["installment:2", "6000", "invoice", "2026-11-01"],
      ["line:2", "12000", "subscription", "2026-12-01"],
    ],
  );
});
test("start-now and annual retainers have only subscription ownership", () => {
  const draft = agreementDraft();
  draft.lines[0].recurrenceMonths = 12;
  draft.installments = [];
  const obligations = deriveBillingObligations(draft, "2026-10-01");
  assert.equal(obligations.length, 1);
  assert.equal(obligations[0].owner, "subscription");
  assert.equal(obligations[0].recurrenceMonths, 12);
});
test("rejects unallocated one-off amounts and dates before signing", () => {
  const draft = agreementDraft();
  draft.installments[1].amountPence = "5999";
  assert.throws(() => deriveBillingObligations(draft, "2026-09-06"));
  assert.throws(
    () => deriveBillingObligations(agreementDraft(), "2026-11-01"),
    /signed/,
  );
});
