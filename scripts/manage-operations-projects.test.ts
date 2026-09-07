import assert from "node:assert/strict";
import test from "node:test";
import { deliveryOperationSchema } from "./manage-operations-projects";
const uuid = "11111111-1111-4111-8111-111111111111";
test("delivery operator requires an explicit tenant, reviewed command and current version", () => {
  const operation = {
    target: "document",
    organisationId: uuid,
    command: {
      action: "revoke",
      documentId: uuid,
      expectedVersion: 1,
      reviewReference: "reviewed-revocation",
    },
  };
  assert.equal(deliveryOperationSchema.parse(operation).target, "document");
  for (const invalid of [
    { ...operation, organisationId: undefined },
    { ...operation, target: "growth" },
    {
      ...operation,
      command: { ...operation.command, expectedVersion: undefined },
    },
    { ...operation, command: { ...operation.command, reviewReference: "" } },
    { ...operation, actorId: "forged" },
  ])
    assert.throws(() => deliveryOperationSchema.parse(invalid));
});
