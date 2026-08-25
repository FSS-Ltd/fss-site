import assert from "node:assert/strict";
import test from "node:test";

import { submitLeadCapture, type LeadCapturePayload } from "./lead-capture";

const payload: LeadCapturePayload = {
  firstName: "Jean",
  lastName: "Fidele",
  workEmail: "j.ntagengwa@faithfulsoftware.dev",
  company: "Faithful Software Solutions",
  challenge: "Replace a manual process.",
  sourceContext: "resource",
  sourcePath: "/resources/manual-process-audit",
  resourceSlug: "manual-process-audit",
  submissionId: "11111111-1111-4111-8111-111111111111",
  newsletterOptIn: true,
};

test("submits leads through the first-party API without a hosting-provider fallback", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

  globalThis.fetch = async (input, init) => {
    requests.push({ input, init });
    return Response.json({ ok: true, leadId: "lead-1" });
  };

  try {
    const result = await submitLeadCapture(payload);

    assert.deepEqual(result, { ok: true, leadId: "lead-1" });
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.input, "/api/lead");
    assert.equal(requests[0]?.init?.method, "POST");
    assert.deepEqual(JSON.parse(String(requests[0]?.init?.body)), payload);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
