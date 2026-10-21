import assert from "node:assert/strict";
import test from "node:test";
import { agreementDraft } from "./fixtures";
import { submittedCommercialTerms } from "./commercial-presentation";
import type { CommercialOffer } from "./commercial-types";

const offer: CommercialOffer = {
  id: "11111111-1111-4111-8111-111111111111",
  organisationId: "22222222-2222-4222-8222-222222222222",
  engagementId: "33333333-3333-4333-8333-333333333333",
  version: 2,
  status: "expired",
  recordedStatus: "proposed",
  draft: { ...agreementDraft(), currency: "GBP" },
  spec: { cash: { mode: "client_proposed" }, revenueShare: null },
  expiresAt: "2026-10-16T09:09:00.000Z",
  selection: { option: "cash", recurringAmountMinor: "2000" },
  rejectionReason: null,
  approvalId: null,
  agreementId: null,
};

test("shows an expired submitted cash budget with its billing interval", () => {
  assert.equal(submittedCommercialTerms(offer), "£20.00 GBP per month");
});

test("does not imply that an unanswered offer has a submitted budget", () => {
  assert.equal(submittedCommercialTerms({ ...offer, selection: null }), null);
});

test("shows the submitted revenue-share choice after expiry", () => {
  assert.equal(
    submittedCommercialTerms({
      ...offer,
      selection: { option: "revenue_share", percentageBps: 2500 },
    }),
    "25.00% revenue share",
  );
});
