import assert from "node:assert/strict";
import test from "node:test";
import { enquiryCreatesCharge, parseOfferEnquiry } from "./enquiries";
import { renewalWorkItems } from "../retention/renewals";
import { hasExplicitRisk, retentionOutcomeSchema } from "../retention/outcomes";

test("enquiry is bounded, idempotent-shaped and never a charge command", () => {
  const enquiry = parseOfferEnquiry({
    offerId: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    interest: "We need calmer support.",
    context: {},
  });
  assert.equal(enquiry.interest, "We need calmer support.");
  assert.equal(enquiry.preferredStart, null);
  assert.equal(enquiryCreatesCharge(), false);
  assert.throws(() => parseOfferEnquiry({ ...enquiry, interest: "" }));
  assert.throws(() =>
    parseOfferEnquiry({ ...enquiry, preferredStart: "x".repeat(1001) }),
  );
  assert.throws(() => parseOfferEnquiry({ ...enquiry, preferredStart: " " }));
});

test("renewal reminders follow the notice deadline and change with a revised date", () => {
  const base = {
    serviceInstanceId: "service",
    agreementId: "agreement",
    organisationId: "organisation",
    renewalDate: "2027-06-30",
    noticeDeadline: "2027-05-31",
  };
  assert.deepEqual(
    renewalWorkItems(base).map((item) => item.dueDate),
    ["2027-04-01", "2027-05-01", "2027-05-17"],
  );
  assert.notDeepEqual(
    renewalWorkItems(base),
    renewalWorkItems({
      ...base,
      renewalDate: "2027-07-31",
      noticeDeadline: "2027-06-30",
    }),
  );
});

test("retention records named goals and human-readable risks", () => {
  const outcome = retentionOutcomeSchema.parse({
    goal: "Confirm the next support term",
    riskReason: "The client has not confirmed budget.",
  });
  assert.equal(hasExplicitRisk(outcome), true);
  assert.equal(outcome.outcome, "");
});
