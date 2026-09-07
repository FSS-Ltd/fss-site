import assert from "node:assert/strict";
import test from "node:test";
import {
  createRequestSchema,
  founderRequestCommandSchema,
  portalRequestCommandSchema,
} from "./validation";
const id = "11111111-1111-4111-8111-111111111111";
const request = {
  projectId: id,
  title: "Request",
  description: "Description",
  type: "work",
  desiredOutcome: "Outcome",
  idempotencyKey: id,
};
for (const [name, patch] of Object.entries({
  emptyTitle: { title: " " },
  longTitle: { title: "x".repeat(161) },
  longDescription: { description: "x".repeat(10001) },
  missingOutcome: { desiredOutcome: "" },
  badDate: { desiredDate: "2026-02-30" },
  unknownAttachment: { attachments: [id] },
  injectedIdentity: { userId: id },
  injectedPriority: { priority: "urgent" },
  incompleteBug: { type: "bug" },
}))
  test(`creation rejects ${name}`, () => {
    assert.equal(
      createRequestSchema.safeParse({ ...request, ...patch }).success,
      false,
    );
  });
test("bug evidence and plain text are preserved without HTML execution semantics", () => {
  const input = createRequestSchema.parse({
    ...request,
    type: "bug",
    title: "<script>alert(1)</script>",
    reproductionSteps: "Open page",
    expectedBehaviour: "Load",
    actualBehaviour: "Error",
  });
  assert.equal(input.title, "<script>alert(1)</script>");
  assert.equal(input.reproductionSteps, "Open page");
});
test("review commands require exact cycle/version and feedback", () => {
  assert.equal(
    portalRequestCommandSchema.safeParse({
      action: "accept",
      requestId: id,
      expectedVersion: 1,
      deliverableVersion: "v1",
    }).success,
    false,
  );
  assert.equal(
    portalRequestCommandSchema.safeParse({
      action: "request_changes",
      requestId: id,
      expectedVersion: 1,
      deliverableVersion: "v1",
      reviewCycle: 1,
      feedback: "",
    }).success,
    false,
  );
});
test("founder cannot split capacity by choosing arbitrary owner IDs", () => {
  assert.equal(
    founderRequestCommandSchema.safeParse({
      action: "acknowledge",
      requestId: id,
      expectedVersion: 1,
      ownerDisplay: "FSS",
      deliveryOwnerId: id,
      scope: "included",
    }).success,
    false,
  );
});
