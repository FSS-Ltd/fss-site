import assert from "node:assert/strict";
import test from "node:test";
import { crmCommandSchema, captureLeadSchema } from "./schemas";

const capture = {
  kind: "capture",
  requestId: "cfdb8851-60ae-41c4-81cc-b1009593b421",
  businessName: "Example Engineering",
  companyNumber: " ab 123456 ",
  corporateType: "limited_company",
  sector: "Engineering",
  locality: "Maidstone",
  sourceUrl: "https://example.test/about",
  websiteUrl: null,
  opportunitySummary: "Replace manual enquiries",
  recommendedOffer: "Website",
  oneOffMinPence: 100000,
  oneOffMaxPence: 200000,
  monthlyPence: 0,
};
test("capture normalizes corporate identity without allowing verification or consent overrides", () => {
  const parsed = captureLeadSchema.parse(capture);
  assert.equal(parsed.companyNumber, "AB123456");
  assert.equal(
    crmCommandSchema.safeParse({ ...capture, corporateStatus: "active" })
      .success,
    false,
  );
  assert.equal(
    crmCommandSchema.safeParse({ ...capture, newsletterOptIn: true }).success,
    false,
  );
});
test("capture rejects invalid ranges, unsafe URLs, unknown fields and oversized source content", () => {
  for (const patch of [
    { oneOffMinPence: 300000 },
    { oneOffMaxPence: 1.5 },
    { sourceUrl: "javascript:alert(1)" },
    { sourceUrl: "https://user:password@example.test" },
    { businessName: "x".repeat(201) },
    { companyNumber: "" },
    { county: "Surrey" },
  ])
    assert.equal(
      captureLeadSchema.safeParse({ ...capture, ...patch }).success,
      false,
    );
});
test("contact capture requires explicit source, verification date and lawful basis", () => {
  assert.equal(
    captureLeadSchema.safeParse({
      ...capture,
      contact: { email: "person@example.test" },
    }).success,
    false,
  );
  const result = captureLeadSchema.parse({
    ...capture,
    contact: {
      firstName: "Ada",
      lastName: "Lovelace",
      email: " Ada@Example.test ",
      roleTitle: null,
      sourceUrl: "https://example.test/team",
      verifiedAt: "2026-10-26T12:00:00Z",
      lawfulBasis: "legitimate_interests",
    },
  });
  assert.equal(result.contact?.email, "ada@example.test");
});
test("task promotion requires independent positive versions for prospect and task", () => {
  const command = {
    kind: "promote_task",
    prospectId: "cfdb8851-60ae-41c4-81cc-b1009593b421",
    taskId: "dfdb8851-60ae-41c4-81cc-b1009593b421",
    expectedVersion: 2,
    prospectVersion: 4,
  };
  assert.equal(crmCommandSchema.safeParse(command).success, true);
  assert.equal(
    crmCommandSchema.safeParse({ ...command, prospectVersion: 0 }).success,
    false,
  );
});
