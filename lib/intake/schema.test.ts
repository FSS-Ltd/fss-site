import assert from "node:assert/strict";
import test from "node:test";

import { intakeSubmissionPayloadSchema, intakeSubmissionSchema } from "./schema";

function validValues() {
  return {
    firstName: "Ada",
    email: "ada@example.com",
    businessName: "Analytical Engines Ltd",
    stage: "idea" as const,
    ideaDescription: "A tool that helps small bakeries manage custom orders.",
    problem: "Bakeries lose track of custom orders across texts, calls, and DMs.",
    targetCustomer: "Independent bakeries taking 10+ custom orders a week.",
    demandEvidence: "informal" as const,
    goals6to12Months: "Get ten bakeries using it and prove they'll pay monthly.",
    primaryGoal: "test-demand" as const,
    audienceSize: "none" as const,
    productNeed: "people-do-things" as const,
    willingnessToPay: "believe-so" as const,
  };
}

test("accepts a valid intake submission with only required fields", () => {
  const result = intakeSubmissionSchema.safeParse(validValues());

  assert.equal(result.success, true);
});

test("rejects a submission missing a required narrative field", () => {
  const values: Record<string, unknown> = validValues();
  delete values.problem;

  const result = intakeSubmissionSchema.safeParse(values);

  assert.equal(result.success, false);
});

test("rejects an unrecognised select option", () => {
  const values = { ...validValues(), stage: "not-a-real-stage" };

  const result = intakeSubmissionSchema.safeParse(values);

  assert.equal(result.success, false);
});

test("rejects narrative text over the length limit", () => {
  const values = { ...validValues(), ideaDescription: "a".repeat(2001) };

  const result = intakeSubmissionSchema.safeParse(values);

  assert.equal(result.success, false);
});

test("requires sourcePath on the server payload schema", () => {
  const result = intakeSubmissionPayloadSchema.safeParse(validValues());

  assert.equal(result.success, false);
});

test("accepts the server payload schema once sourcePath is included", () => {
  const result = intakeSubmissionPayloadSchema.safeParse({
    ...validValues(),
    sourcePath: "/start",
  });

  assert.equal(result.success, true);
});
