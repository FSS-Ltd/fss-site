import assert from "node:assert/strict";
import test from "node:test";
import { captureLeadSchema } from "./schemas";
import { crmValidationFeedback } from "./validation-feedback";

const input = {
  kind: "capture",
  requestId: "cfdb8851-60ae-41c4-81cc-b1009593b421",
  businessName: "Global business",
  companyNumber: "123",
  countryCode: "GB",
  corporateType: "limited_company",
  sector: "Engineering",
  locality: "London",
  sourceUrl: "https://example.test",
  websiteUrl: null,
  opportunitySummary: "Review enquiries",
  recommendedOffer: "Website",
  oneOffMinPence: 0,
  oneOffMaxPence: 0,
  monthlyPence: 0,
};
test("the reported company-number failure becomes actionable field feedback", () => {
  const result = captureLeadSchema.safeParse(input);
  assert.equal(result.success, false);
  if (result.success) return;
  const feedback = crmValidationFeedback(result.error);
  assert.equal(feedback.message, "Check the highlighted fields and try again.");
  assert.equal(feedback.fieldErrors?.[0]?.name, "companyNumber");
  assert.match(
    feedback.fieldErrors?.[0]?.message ?? "",
    /8-character UK company number/,
  );
  assert.doesNotMatch(
    JSON.stringify(feedback),
    /invalid_format|regex|pattern|Invalid string/,
  );
});
test("international registrations and city names are accepted without the UK length rule", () => {
  const parsed = captureLeadSchema.parse({
    ...input,
    countryCode: "US",
    companyNumber: "12-3456789",
    locality: "New York",
  });
  assert.equal(parsed.companyNumber, "12-3456789");
  assert.equal(parsed.countryCode, "US");
  assert.equal(
    captureLeadSchema.safeParse({ ...input, countryCode: "ZZ" }).success,
    false,
  );
});
