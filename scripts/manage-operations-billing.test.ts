import assert from "node:assert/strict";
import test from "node:test";
import { billingOperationSchema } from "./manage-operations-billing";
const id = "10000000-0000-4000-8000-000000000001";
test("billing operator accepts only stored obligations and explicit amendment previews", () => {
  assert.equal(
    billingOperationSchema.parse({
      action: "issue",
      organisationId: id,
      scheduleId: id,
      commandKey: id,
    }).action,
    "issue",
  );
  for (const forged of [
    {
      action: "issue",
      organisationId: id,
      scheduleId: id,
      commandKey: id,
      amount: "10000",
    },
    { action: "schedule", organisationId: id, agreementId: id, revision: 0 },
    { action: "approve-amendment", organisationId: id, previewId: id },
  ])
    assert.equal(billingOperationSchema.safeParse(forged).success, false);
});
