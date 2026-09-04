import assert from "node:assert/strict";
import test from "node:test";
import { prepareContactRequest, type ContactValues } from "./contact-request";
import { leadSubmissionSchema } from "./lead-capture";

const submissionId = "f30c5bd8-3af7-4d39-9b35-1e59ce564c27";
const valid: ContactValues = {
  firstName: " Ada ",
  lastName: "Lovelace",
  workEmail: "ada@example.org",
  company: " A charity ",
  challenge: "Attendance reporting",
  service: "Custom software",
  newsletterOptIn: false,
};

test("contact request normalises data and produces the existing lead API contract", () => {
  const result = prepareContactRequest(valid, submissionId);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(result.data, {
    firstName: "Ada",
    lastName: "Lovelace",
    workEmail: "ada@example.org",
    company: "A charity",
    challenge: "Custom software: Attendance reporting",
    newsletterOptIn: false,
    sourceContext: "contact-page-v2",
    sourcePath: "/contact",
    submissionId,
  });
  assert.equal(leadSubmissionSchema.safeParse(result.data).success, true);
});

test("contact validation catches blank required fields and invalid email before submission", () => {
  const result = prepareContactRequest(
    { ...valid, firstName: "  ", company: " ", workEmail: "bad" },
    submissionId,
  );
  assert.equal(result.success, false);
  if (result.success) return;
  assert.deepEqual(
    new Set(result.error.issues.map((issue) => issue.path[0])),
    new Set(["firstName", "company", "workEmail"]),
  );
});

test("contact challenge including the service choice cannot exceed the API limit", () => {
  assert.equal(
    prepareContactRequest(
      { ...valid, challenge: "x".repeat(583) },
      submissionId,
    ).success,
    true,
  );
  assert.equal(
    prepareContactRequest(
      { ...valid, challenge: "x".repeat(584) },
      submissionId,
    ).success,
    false,
  );
});

test("an optional empty challenge and no service choice remain optional", () => {
  const result = prepareContactRequest(
    { ...valid, service: "Not sure yet", challenge: " " },
    submissionId,
  );
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.challenge, undefined);
});
