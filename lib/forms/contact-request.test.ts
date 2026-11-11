import assert from "node:assert/strict";
import test from "node:test";
import {
  buildContactChallenge,
  contactDetailLimit,
  prepareContactRequest,
  type ContactValues,
} from "./contact-request";
import { leadSubmissionSchema } from "./lead-capture";

const submissionId = "f30c5bd8-3af7-4d39-9b35-1e59ce564c27";
const valid: ContactValues = {
  firstName: " Ada ",
  lastName: "Lovelace",
  workEmail: "ada@example.org",
  company: " A charity ",
  need: "Reporting",
  detail: "Attendance reporting",
  tools: ["Xero", "Spreadsheets"],
  teamSize: "2 to 10",
  timing: "Within 3 months",
  newsletterOptIn: false,
};

test("every answer lands in the existing lead API contract", () => {
  const result = prepareContactRequest(valid, submissionId);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(result.data, {
    firstName: "Ada",
    lastName: "Lovelace",
    workEmail: "ada@example.org",
    company: "A charity",
    challenge:
      "Need: Reporting; Tools: Xero, Spreadsheets; Team: 2 to 10; Timing: Within 3 months; Detail: Attendance reporting",
    newsletterOptIn: false,
    sourceContext: "contact-page-v3",
    sourcePath: "/contact",
    submissionId,
  });
  assert.equal(leadSubmissionSchema.safeParse(result.data).success, true);
});

test("skipped tools and empty detail are left out", () => {
  assert.equal(
    buildContactChallenge({ ...valid, tools: [], detail: "  " }),
    "Need: Reporting; Team: 2 to 10; Timing: Within 3 months",
  );
});

test("the Not sure yet path still produces a valid request", () => {
  const result = prepareContactRequest(
    { ...valid, need: "Not sure yet", tools: [], detail: "" },
    submissionId,
  );
  assert.equal(result.success, true);
  if (result.success)
    assert.match(result.data.challenge ?? "", /^Need: Not sure yet; Team/);
});

test("contact validation catches blank required fields and invalid email", () => {
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

test("long detail is capped so the challenge never exceeds 600 characters", () => {
  const long = { ...valid, detail: "x".repeat(2000) };
  const challenge = buildContactChallenge(long) ?? "";
  assert.ok(challenge.length <= 600);
  assert.ok(contactDetailLimit() < 600);
  assert.equal(prepareContactRequest(long, submissionId).success, true);
});

test("no answers at all keeps the challenge optional", () => {
  const result = prepareContactRequest(
    { ...valid, need: "", tools: [], teamSize: "", timing: "", detail: " " },
    submissionId,
  );
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.challenge, undefined);
});

test("the detail limit reserves room for the longest later answers", () => {
  const typed = "x".repeat(contactDetailLimit());
  const worst: ContactValues = {
    ...valid,
    need: "AI on our own data, privately",
    tools: [
      "Microsoft 365",
      "Google Workspace",
      "Xero",
      "HubSpot",
      "Salesforce",
      "Spreadsheets",
      "Other",
    ],
    teamSize: "51 to 250",
    timing: "As soon as possible",
    detail: typed,
  };
  const challenge = buildContactChallenge(worst) ?? "";
  assert.ok(challenge.endsWith(`Detail: ${typed}`));
  assert.ok(challenge.length <= 600);
  assert.equal(prepareContactRequest(worst, submissionId).success, true);
});

test("a cut never leaves half a surrogate pair", () => {
  const detail = "x".repeat(contactDetailLimit() - 1) + "😀";
  const challenge = buildContactChallenge({ ...valid, detail }) ?? "";
  assert.equal(/[\uD800-\uDBFF]$/.test(challenge), false);
});
