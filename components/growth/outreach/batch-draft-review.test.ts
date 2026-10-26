import assert from "node:assert/strict";
import test from "node:test";
import {
  canSendBatchDraft,
  loadBatchDraft,
  sendBatchDraft,
  type BatchDraftEntry,
} from "./batch-draft-review";
import { draftDeliveryLabel } from "./research-draft-request";

const permission = {
  basis: "consent",
  evidence: "Recipient requested this specific email.",
};
const id = "11111111-1111-4111-8111-111111111111";
function entry(): BatchDraftEntry {
  return {
    draftTaskId: id,
    businessName: "Example",
    result: null,
    error: null,
    message: {
      draftTaskId: id,
      version: 2,
      prospectVersion: 3,
      researchOnly: true,
      approvalFingerprint: "a".repeat(64),
      businessName: "Example",
      contactName: "Business contact",
      contactEmail: "business@example.test",
      subject: "Reviewed subject",
      previewText: "Reviewed copy.",
      eligibility: { ready: true, reasons: [] },
    },
  };
}

test("loads only the requested current draft and rejects changed identities", async (t) => {
  const draft = entry().message!;
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    async (path: string, options: RequestInit) => {
      assert.equal(path, `/api/growth/messages/${id}/review`);
      assert.equal(options.cache, "no-store");
      assert.ok(options.signal);
      return Response.json({ status: "ready", data: draft });
    },
  );
  assert.deepEqual(
    await loadBatchDraft(id, new AbortController().signal),
    draft,
  );
  fetch.mock.mockImplementation(async () =>
    Response.json({
      status: "ready",
      data: { ...draft, draftTaskId: "22222222-2222-4222-8222-222222222222" },
    }),
  );
  await assert.rejects(
    loadBatchDraft(id, new AbortController().signal),
    /no longer available/,
  );
});

test("unavailable, malformed, and unauthorized review responses cannot be sent", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ status: "unavailable", reason: "Already approved" }),
  );
  await assert.rejects(loadBatchDraft(id, new AbortController().signal));
  fetch.mock.mockImplementation(async () =>
    Response.json({ status: "ready", data: {} }),
  );
  await assert.rejects(loadBatchDraft(id, new AbortController().signal));
  fetch.mock.mockImplementation(async () =>
    Response.json({ message: "Unauthorized" }, { status: 401 }),
  );
  await assert.rejects(loadBatchDraft(id, new AbortController().signal));
});

test("sends research and legacy approvals through their versioned endpoints", async (t) => {
  const sent: { path: string; body: unknown }[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (path: string, options: RequestInit) => {
      sent.push({ path, body: JSON.parse(String(options.body)) });
      return Response.json({
        status: "sent",
        sequenceEnrollmentId: "sequence",
      });
    },
  );
  const draft = entry();
  assert.deepEqual(await sendBatchDraft(draft, permission), {
    status: "sent",
    sequenceEnrollmentId: "sequence",
  });
  draft.message = {
    ...draft.message!,
    researchOnly: false,
    approvalFingerprint: undefined,
  };
  await sendBatchDraft(draft, permission);
  assert.deepEqual(sent, [
    {
      path: `/api/growth/messages/${id}/approve-research-send`,
      body: {
        expectedVersion: 2,
        expectedProspectVersion: 3,
        fingerprint: "a".repeat(64),
        permission: {
          basis: "consent",
          evidence: "Recipient requested this specific email.",
        },
      },
    },
    {
      path: `/api/growth/messages/${id}/approve-send`,
      body: { expectedVersion: 2 },
    },
  ]);
});

test("blocked and incomplete reviews never issue send requests", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return Response.json({});
  });
  for (const message of [
    null,
    {
      ...entry().message!,
      eligibility: { ready: false, reasons: ["Suppressed"] },
    },
    { ...entry().message!, approvalFingerprint: undefined },
  ]) {
    const draft = { ...entry(), message };
    assert.equal(canSendBatchDraft(draft), false);
    await assert.rejects(sendBatchDraft(draft, permission), /not ready/);
  }
  assert.equal(requests, 0);
});

test("reports delivery outcomes accurately without retrying uncertain sends", async (t) => {
  let requests = 0;
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return Response.json({ message: "Draft changed" }, { status: 409 });
  });
  await assert.rejects(sendBatchDraft(entry(), permission), /Draft changed/);
  assert.equal(requests, 1);
  fetch.mock.mockImplementation(async () =>
    Response.json({ status: "pending" }),
  );
  assert.equal(
    draftDeliveryLabel(await sendBatchDraft(entry(), permission)),
    "Approval saved. Delivery has not yet been confirmed.",
  );
  assert.equal(draftDeliveryLabel({ status: "sent" }), "Email sent.");
  assert.match(draftDeliveryLabel({ status: "failed" }), /Delivery failed/);
  assert.match(
    draftDeliveryLabel({ status: "cancelled" }),
    /Sending was cancelled/,
  );
  assert.match(draftDeliveryLabel({}), /not yet been confirmed/);
});
