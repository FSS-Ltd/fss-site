import assert from "node:assert/strict";
import test from "node:test";

import { NewsletterConsentError } from "../newsletter/subscribers";
import {
  submitLead,
  type InboundLeadRecord,
  type InsertInboundLeadInput,
  type SubmitLeadDependencies,
  type SubmitLeadInput,
} from "./submit-lead";

const NOW = new Date("2026-01-15T00:00:00Z");

function createHarness(overrides: Partial<SubmitLeadDependencies> = {}) {
  const leads = new Map<string, InboundLeadRecord>();
  const consentCalls: { input: SubmitLeadInput; consentedAt: Date }[] = [];
  const auditCalls: { leadId: string; submissionId: string }[] = [];
  let nextId = 1;

  const dependencies: SubmitLeadDependencies = {
    insertInboundLead: async (input: InsertInboundLeadInput) => {
      const existing = leads.get(input.submissionId);
      if (existing) {
        return { record: existing, alreadyExisted: true };
      }
      const record: InboundLeadRecord = {
        id: `lead-${nextId++}`,
        submissionId: input.submissionId,
        workEmail: input.workEmail,
      };
      leads.set(input.submissionId, record);
      return { record, alreadyExisted: false };
    },
    recordNewsletterConsent: async (input, consentedAt) => {
      consentCalls.push({ input, consentedAt });
    },
    appendLeadAuditEvent: async (leadId, submissionId) => {
      auditCalls.push({ leadId, submissionId });
    },
    now: () => NOW,
    ...overrides,
  };

  return { dependencies, leads, consentCalls, auditCalls };
}

function leadInput(overrides: Partial<SubmitLeadInput> = {}): SubmitLeadInput {
  return {
    submissionId: "11111111-1111-4111-8111-111111111111",
    submissionType: "site_enquiry",
    firstName: "Ada",
    lastName: "Lovelace",
    workEmail: "ada@example.test",
    businessName: "Lovelace Systems",
    sourcePath: "/contact",
    sourceContext: "contact_form",
    newsletterOptIn: false,
    ...overrides,
  };
}

test("inserts a new inbound lead and appends an audit event", async () => {
  const { dependencies, auditCalls } = createHarness();
  const result = await submitLead(leadInput(), dependencies);

  assert.equal(result.alreadySubmitted, false);
  assert.equal(result.submissionId, "11111111-1111-4111-8111-111111111111");
  assert.deepEqual(auditCalls, [{ leadId: result.leadId, submissionId: result.submissionId }]);
});

test("a repeated submission id is idempotent and does not re-record consent or audit", async () => {
  const { dependencies, consentCalls, auditCalls } = createHarness();
  const first = await submitLead(leadInput({ newsletterOptIn: true }), dependencies);
  const second = await submitLead(leadInput({ newsletterOptIn: true }), dependencies);

  assert.equal(first.alreadySubmitted, false);
  assert.equal(second.alreadySubmitted, true);
  assert.equal(second.leadId, first.leadId);
  assert.equal(consentCalls.length, 1);
  assert.equal(auditCalls.length, 1);
});

test("records newsletter consent only when the opt-in box is true", async () => {
  const { dependencies, consentCalls } = createHarness();
  await submitLead(leadInput({ newsletterOptIn: false }), dependencies);

  assert.equal(consentCalls.length, 0);
});

test("records newsletter consent with the submission's own details when opted in", async () => {
  const { dependencies, consentCalls } = createHarness();
  await submitLead(
    leadInput({ newsletterOptIn: true, workEmail: "ada@example.test", firstName: "Ada" }),
    dependencies,
  );

  assert.equal(consentCalls.length, 1);
  assert.equal(consentCalls[0].input.workEmail, "ada@example.test");
  assert.deepEqual(consentCalls[0].consentedAt, NOW);
});

test("a suppressed newsletter address does not block the lead submission", async () => {
  const { dependencies, auditCalls } = createHarness({
    recordNewsletterConsent: async () => {
      throw new NewsletterConsentError("already_suppressed", "suppressed");
    },
  });

  const result = await submitLead(leadInput({ newsletterOptIn: true }), dependencies);

  assert.equal(result.alreadySubmitted, false);
  assert.equal(auditCalls.length, 1);
});

test("an unexpected error while recording consent propagates and is not swallowed", async () => {
  const { dependencies } = createHarness({
    recordNewsletterConsent: async () => {
      throw new Error("connection reset");
    },
  });

  await assert.rejects(submitLead(leadInput({ newsletterOptIn: true }), dependencies), /connection reset/);
});
