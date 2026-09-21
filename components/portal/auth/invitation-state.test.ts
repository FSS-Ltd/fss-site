import assert from "node:assert/strict";
import test from "node:test";
import { isExpiredInvitationStatus } from "./invitation-state";

test("only the explicit expired invitation state selects the expired path", () => {
  assert.equal(isExpiredInvitationStatus("expired"), true);
  assert.equal(isExpiredInvitationStatus(null), false);
  assert.equal(isExpiredInvitationStatus("invalid"), false);
});
