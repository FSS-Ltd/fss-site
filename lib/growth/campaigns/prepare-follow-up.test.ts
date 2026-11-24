import assert from "node:assert/strict";
import test from "node:test";
import {
  buildControlledFirstMessage,
  buildControlledFollowUp,
  validateControlledCopy,
} from "./controlled-copy";
import { websiteServiceOffers } from "./website-service-offers";

const base = {
  campaignId: "4acff217-ea77-429c-a5b0-9a52e82f87ac",
  policyVersion: 1,
  businessId: "6e6e5795-5c30-47dc-a454-dc14df3b8192",
  market: "GB",
  jurisdiction: "GB",
  businessName: "Sample Business",
  observation: "The website offers appointment booking",
  offer: "booking_recovery_v1",
  commercialTerms: websiteServiceOffers.booking_recovery_v1,
  variants: [
    { id: "a", version: 1, cta: "May I send details?" },
    { id: "b", version: 1, cta: "Could I send details?" },
  ],
};

test("follow-ups retain subject, original arm and opt-out with distinct truthful messages", () => {
  const first = buildControlledFirstMessage(base);
  const step1 = buildControlledFollowUp({ ...base, step: 1 });
  const step2 = buildControlledFollowUp({ ...base, step: 2 });
  assert.ok(first && step1 && step2);
  assert.equal(first.subject, step1.subject);
  assert.equal(first.subject, step2.subject);
  assert.equal(first.variantId, step1.variantId);
  assert.equal(step1.variantId, step2.variantId);
  assert.notEqual(first.text, step1.text);
  assert.notEqual(step1.text, step2.text);
  assert.match(step2.text, /prefer not to receive further emails/i);
  assert.equal(
    validateControlledCopy({
      ...base,
      step: 1,
      variantId: first.variantId,
      variantVersion: first.variantVersion,
      copy: step1,
    }),
    true,
  );
  assert.equal(
    validateControlledCopy({
      ...base,
      step: 1,
      variantId: first.variantId,
      variantVersion: first.variantVersion,
      copy: step2,
    }),
    false,
  );
  assert.equal(
    buildControlledFollowUp({ ...base, step: 1, commercialTerms: undefined }),
    null,
  );
});
