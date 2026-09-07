import assert from "node:assert/strict";
import test from "node:test";
import { reviewedRequestOperationSchema } from "./manage-operations-requests";
const id = "10000000-0000-4000-8000-000000000001";
test("reviewed request operation binds organisation and expected version without accepting trusted roles", () => {
  const operation = {
    organisationId: id,
    command: {
      action: "designate_reviewer",
      requestId: id,
      expectedVersion: 1,
      userId: id,
      enabled: true,
    },
  };
  assert.ok(reviewedRequestOperationSchema.safeParse(operation).success);
  assert.equal(
    reviewedRequestOperationSchema.safeParse({ ...operation, role: "founder" })
      .success,
    false,
  );
  assert.equal(
    reviewedRequestOperationSchema.safeParse({
      ...operation,
      organisationId: "invalid",
    }).success,
    false,
  );
  assert.equal(
    reviewedRequestOperationSchema.safeParse({
      ...operation,
      command: { ...operation.command, expectedVersion: 0 },
    }).success,
    false,
  );
});
