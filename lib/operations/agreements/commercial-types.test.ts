import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { agreementDraft } from "./fixtures";
import {
  commercialOfferSpecSchema,
  commercialSelectionDraft,
  portalCommercialOfferCommandSchema,
  publishCommercialOfferSchema,
  recurringTotalMinor,
} from "./commercial-types";
const shareTerms = {
  revenueSource: "Product sales",
  calculationBasis: "Collected revenue excluding refunds",
  duration: "12 months",
  reportingRequirements: "Monthly report",
  paymentTerms: "Pay within 14 days",
};
function recurringDraft() {
  const draft = agreementDraft();
  return {
    ...draft,
    lines: [
      ...draft.lines,
      {
        ...draft.lines[0],
        serviceCode: "support",
        recurrenceMonths: 1 as const,
        unitPence: "5000",
        taxPence: "1000",
      },
    ],
  };
}
test("offers require an option and every revenue share term", () => {
  assert.equal(
    commercialOfferSpecSchema.safeParse({ cash: null, revenueShare: null })
      .success,
    false,
  );
  assert.equal(
    commercialOfferSpecSchema.safeParse({
      cash: null,
      revenueShare: { mode: "fixed", percentageBps: 1, ...shareTerms },
    }).success,
    true,
  );
  assert.equal(
    commercialOfferSpecSchema.safeParse({
      cash: null,
      revenueShare: {
        mode: "client_proposed",
        ...shareTerms,
        reportingRequirements: "",
      },
    }).success,
    false,
  );
});
test("proposed recurring fees require one shared interval and date range", () => {
  const input = {
    engagementId: randomUUID(),
    draft: recurringDraft(),
    spec: { cash: { mode: "client_proposed" }, revenueShare: null },
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };
  assert.equal(publishCommercialOfferSchema.safeParse(input).success, true);
  const extra = { ...input.draft.lines[1], recurrenceMonths: 3 as const };
  assert.equal(
    publishCommercialOfferSchema.safeParse({
      ...input,
      draft: { ...input.draft, lines: [...input.draft.lines, extra] },
    }).success,
    false,
  );
  assert.equal(
    publishCommercialOfferSchema.safeParse({
      ...input,
      draft: agreementDraft(),
    }).success,
    false,
  );
});
test("revenue share replaces recurring money while retaining service activation and installments", () => {
  const draft = recurringDraft();
  const spec = commercialOfferSpecSchema.parse({
    cash: { mode: "fixed" },
    revenueShare: { mode: "fixed", percentageBps: 2500, ...shareTerms },
  });
  const result = commercialSelectionDraft(draft, spec, "revenue_share");
  assert.deepEqual(result.lines[0], draft.lines[0]);
  assert.deepEqual(result.installments, draft.installments);
  assert.equal(result.lines[1].serviceCode, "support");
  assert.equal(result.lines[1].recurrenceMonths, 1);
  assert.equal(recurringTotalMinor(result), "0");
  assert.equal(result.revenueShare?.percentageBps, 2500);
  assert.equal(
    commercialSelectionDraft(result, spec, "cash").revenueShare,
    undefined,
  );
});
test("client proposals enforce floors and reject additional payload fields", () => {
  const binding = {
    action: "select",
    offerId: randomUUID(),
    expectedVersion: 1,
  };
  assert.equal(
    portalCommercialOfferCommandSchema.safeParse({
      ...binding,
      option: "cash",
      recurringAmountMinor: "1999",
    }).success,
    false,
  );
  assert.equal(
    portalCommercialOfferCommandSchema.safeParse({
      ...binding,
      option: "cash",
      recurringAmountMinor: "2000",
    }).success,
    true,
  );
  assert.equal(
    portalCommercialOfferCommandSchema.safeParse({
      ...binding,
      option: "revenue_share",
      percentageBps: 999,
    }).success,
    false,
  );
  assert.equal(
    portalCommercialOfferCommandSchema.safeParse({
      ...binding,
      option: "revenue_share",
      percentageBps: 10001,
    }).success,
    false,
  );
  assert.equal(
    portalCommercialOfferCommandSchema.safeParse({
      ...binding,
      option: "cash",
      actorId: "spoof",
    }).success,
    false,
  );
});
