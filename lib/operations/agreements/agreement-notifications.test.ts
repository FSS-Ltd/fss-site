import assert from "node:assert/strict";
import test from "node:test";
import {
  agreementNotificationEmail,
  type AgreementNotification,
} from "./agreement-notifications";

const notification: AgreementNotification = {
  id: "10000000-0000-4000-8000-000000000001",
  organisationId: "20000000-0000-4000-8000-000000000001",
  offerId: null,
  approvalId: "30000000-0000-4000-8000-000000000001",
  kind: "signing_request",
  recipient: "signer@example.test",
  attempts: 1,
  sendVersion: 1,
  title: "Example agreement",
  organisationName: "Example client",
};

for (const kind of [
  "signing_request",
  "offer_request",
  "budget_request",
] as const) {
  test(`${kind} uses the current portal sender domain`, () => {
    const email = agreementNotificationEmail({
      ...notification,
      kind,
      offerId: kind === "signing_request" ? null : notification.approvalId,
    });
    assert.equal(email.from, "FSS <hello@faithfulsoftware.dev>");
    assert.equal(email.replyTo, "j.ntagengwa@faithfulsoftware.dev");
    assert.equal(email.to, "signer@example.test");
    assert.match(email.text, /organisationId=/);
  });
}
