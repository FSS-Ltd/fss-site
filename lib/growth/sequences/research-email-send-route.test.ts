import assert from "node:assert/strict";
import test from "node:test";
import { FounderAuthorizationError } from "../auth/require-founder";
import { FirstEmailApprovalError } from "./approval";
import {
  createResearchEmailSendHandler,
  type ResearchEmailSendDependencies,
} from "./research-email-send-route";

const origin = "https://example.test";
const context = {
  params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
};
const body = {
  expectedVersion: 2,
  expectedProspectVersion: 3,
  fingerprint: "a".repeat(64),
  permission: { basis: "consent", evidence: "Recipient asked for this email." },
};
function request(value: unknown = body, requestOrigin = origin): Request {
  return new Request(
    `${origin}/api/growth/messages/${"11111111-1111-4111-8111-111111111111"}/approve-research-send`,
    {
      method: "POST",
      headers: { origin: requestOrigin, "content-type": "application/json" },
      body: JSON.stringify(value),
    },
  );
}
function handler(overrides: Partial<ResearchEmailSendDependencies> = {}) {
  return createResearchEmailSendHandler({
    db: {} as never,
    config: { origin },
    founderEmail: "founder@example.test",
    gmailClientId: "id",
    gmailClientSecret: "secret",
    decryptionKeys: {},
    authorizeFounder: async () => ({
      email: "founder@example.test",
      actorId: "b".repeat(64),
    }),
    send: async () => ({ status: "sent", sequenceEnrollmentId: "enrollment" }),
    createCorrelationId: () => "correlation",
    reportUnexpectedError: () => {},
    ...overrides,
  });
}

test("authorised research approval passes exact content and permission identity to immediate send", async () => {
  let received: unknown;
  const response = await handler({
    send: async (input) => {
      received = input;
      return { status: "sent", sequenceEnrollmentId: "enrollment" };
    },
  })(request(), context);
  assert.equal(response.status, 200);
  assert.deepEqual(received, {
    ...body,
    draftTaskId: "11111111-1111-4111-8111-111111111111",
    founder: { email: "founder@example.test", actorId: "b".repeat(64) },
    correlationId: "correlation",
  });
  assert.equal((await response.json()).status, "sent");
});

test("unauthorised, wrong-origin and incomplete-permission requests never reach send", async () => {
  let sends = 0;
  const send = async () => {
    sends++;
    return { status: "sent" as const, sequenceEnrollmentId: "enrollment" };
  };
  assert.equal(
    (await handler({ send })(request(body, "https://other.test"), context))
      .status,
    400,
  );
  assert.equal(
    (
      await handler({
        send,
        authorizeFounder: async () => {
          throw new FounderAuthorizationError();
        },
      })(request(), context)
    ).status,
    401,
  );
  assert.equal(
    (
      await handler({ send })(
        request({ ...body, permission: undefined }),
        context,
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await handler({ send })(
        request({ ...body, permission: { basis: "consent", evidence: "" } }),
        context,
      )
    ).status,
    422,
  );
  assert.equal(sends, 0);
});

test("stale approvals and delivery pending remain distinct from confirmed sends", async () => {
  const stale = await handler({
    send: async () => {
      throw new FirstEmailApprovalError("version_conflict");
    },
  })(request(), context);
  assert.equal(stale.status, 409);
  const pending = await handler({
    send: async () => ({
      status: "pending",
      sequenceEnrollmentId: "enrollment",
    }),
  })(request(), context);
  assert.equal((await pending.json()).status, "pending");
});
