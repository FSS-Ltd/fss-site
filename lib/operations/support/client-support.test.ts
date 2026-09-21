import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePortalSupportRequest,
  supportRequestCreatesCharge,
} from "./client-support";

test("support requests are bounded conversations rather than billing commands", () => {
  const request = parsePortalSupportRequest({
    category: "workspace_access",
    idempotencyKey: crypto.randomUUID(),
    message: "Please help our new colleague reach the workspace.",
    subject: "Workspace access request",
  });

  assert.equal(request.category, "workspace_access");
  assert.equal(supportRequestCreatesCharge(), false);
  assert.throws(() => parsePortalSupportRequest({ ...request, subject: "" }));
});
