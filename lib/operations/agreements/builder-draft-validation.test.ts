import assert from "node:assert/strict";
import test from "node:test";
import { agreementDraft } from "./fixtures";
import { validateAgreementBuilderDraft } from "./builder-draft-validation";
import type { AgreementBuilderDraftContent } from "./builder-draft-schema";

function content(): AgreementBuilderDraftContent {
  const { documentHash, documentReference, ...agreement } = agreementDraft();
  assert.ok(documentHash && documentReference);
  return { agreement, engagementId: "11111111-1111-4111-8111-111111111111" };
}

test("incomplete drafts identify every affected stage without losing valid details", () => {
  const draft = content();
  delete draft.agreement?.goals;
  delete draft.agreement?.billingContact;
  const result = validateAgreementBuilderDraft(draft);
  assert.equal(result.success, false);
  if (result.success) return;
  assert.deepEqual(result.issues, [
    { step: "people", message: "People: Choose a valid billing contact." },
    { step: "scope", message: "Scope: Complete the client outcome." },
  ]);
  assert.equal(draft.agreement?.title, "Website delivery");
});

test("unbalanced installments explain how to reconcile payment amounts", () => {
  const draft = content();
  draft.agreement = {
    ...draft.agreement,
    installments: [{ dueDate: "2026-10-01", amountPence: "1" }],
  };
  const result = validateAgreementBuilderDraft(draft);
  assert.equal(result.success, false);
  if (result.success) return;
  assert.deepEqual(result.issues, [
    {
      step: "fees",
      message:
        "Fees: Make the payment schedule add up to the one-off service total, including tax.",
    },
  ]);
});

test("duplicate signers give a People repair instead of a generic error", () => {
  const draft = content();
  draft.agreement = {
    ...draft.agreement,
    signatories: ["same@example.test", "same@example.test"],
  };
  const result = validateAgreementBuilderDraft(draft);
  assert.equal(result.success, false);
  if (result.success) return;
  assert.deepEqual(result.issues, [
    { step: "people", message: "People: Choose each signer only once." },
  ]);
});

test("one-off agreements with fixed fees remain ready to create", () => {
  assert.equal(validateAgreementBuilderDraft(content()).success, true);
});

test("client-proposed services explain inconsistent billing dates and accept matching ones", () => {
  const draft = content();
  const line = agreementDraft().lines[0];
  draft.agreement = {
    ...draft.agreement,
    lines: [
      { ...line, recurrenceMonths: 1 },
      { ...line, recurrenceMonths: 1, startDate: "2026-11-01" },
    ],
    installments: [],
  };
  draft.commercialOffer = {
    spec: { cash: { mode: "client_proposed" }, revenueShare: null },
    expiresAt: "2026-11-01T00:00:00.000Z",
  };
  const result = validateAgreementBuilderDraft(draft);
  assert.equal(result.success, false);
  if (result.success) return;
  assert.deepEqual(result.issues, [
    {
      step: "fees",
      message:
        "Fees: Use the same billing interval, start date and end date for all client-proposed recurring services.",
    },
  ]);
  assert.ok(draft.agreement.lines);
  draft.agreement.lines[1].startDate = "2026-10-01";
  assert.equal(validateAgreementBuilderDraft(draft).success, true);
});

test("validation feedback never reflects unexpected keys or private contact values", () => {
  const draft = content();
  Object.assign(draft.agreement ?? {}, {
    "private-contact@example.test": "confidential draft text",
  });
  const result = validateAgreementBuilderDraft(draft);
  assert.equal(result.success, false);
  assert.doesNotMatch(
    JSON.stringify(result),
    /private-contact|confidential|billing@example/,
  );
});
