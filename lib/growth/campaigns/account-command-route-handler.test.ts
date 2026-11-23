import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { FounderAuthorizationError } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import { createAccountCommandHandler } from "./account-command-route-handler";
import type { executeAccountControlCommand } from "./account-control";
import type {
  executeResendAccountCommand,
  ResendRuntimeConfiguration,
} from "./resend-account-control";

const email = "j.ntagengwa@faithfulsoftware.dev";
const founder = {
  email,
  actorId: createHash("sha256").update(email).digest("hex"),
};
const requestId = "7482bda4-7099-44f9-a4a7-a6b4c695241a";
const connectionId = "b1756170-0ac5-47ca-a6c9-87b87fdb58b5";
const runtime: ResendRuntimeConfiguration = {
  binding: {
    team: "team",
    environment: "preview",
    sender: "sender@example.com",
    domain: "example.com",
    replyTo: email,
    sendGeneration: "00869510-3d9f-4b48-a93a-d8f0636b4708",
    usageGeneration: "dcfa7d70-9a12-4af4-9cd6-004f691cd69f",
  },
  sendCredential: "synthetic-send-secret",
  usageCredential: "synthetic-usage-secret",
};
const request = (body: object, origin = "https://example.com") =>
  new Request("https://example.com/api", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
function database(prior: object | null = null, current = true): GrowthDb {
  return (async (strings: TemplateStringsArray) => {
    const sql = strings.join(" ");
    if (sql.includes("from growth.outreach_account_reviews"))
      return prior ? [prior] : [];
    if (sql.includes("select i.id from growth.integration_connections"))
      return current ? [{ id: connectionId }] : [];
    throw new Error("unexpected query");
  }) as unknown as GrowthDb;
}
function handler(
  db: GrowthDb,
  gmail: typeof executeAccountControlCommand,
  resend: typeof executeResendAccountCommand,
  authorizeFounder = async () => founder,
) {
  return createAccountCommandHandler({
    db,
    config: { origin: "https://example.com" },
    authorizeFounder,
    executeGmail: gmail,
    executeResend: resend,
    readRuntime: () => runtime,
    createCorrelationId: () => "ref",
    reportUnexpectedError: () => {},
  });
}
const result = {
  status: "ok" as const,
  connectionId,
  version: 5,
  reviewId: requestId,
  alreadyExisted: false,
};

test("requires founder, registered origin and strict non-secret account commands", async () => {
  let calls = 0;
  const gmail: typeof executeAccountControlCommand = async () => {
    calls++;
    return result;
  };
  const resend: typeof executeResendAccountCommand = async () => {
    calls++;
    return result;
  };
  const body = {
    provider: "gmail",
    action: "halt",
    requestId,
    expectedVersion: 4,
    reason: "Review required",
  };
  assert.equal(
    (
      await handler(
        database(),
        gmail,
        resend,
      )(request(body, "https://other.example"))
    ).status,
    400,
  );
  assert.equal(
    (
      await handler(database(), gmail, resend, async () => {
        throw new FounderAuthorizationError();
      })(request(body))
    ).status,
    401,
  );
  assert.equal(
    (
      await handler(
        database(),
        gmail,
        resend,
      )(request({ ...body, connectionId }))
    ).status,
    422,
  );
  assert.equal(
    (await handler(database(), gmail, resend)(request({ ...body, reason: "" })))
      .status,
    422,
  );
  assert.equal(
    (
      await handler(
        database(),
        gmail,
        resend,
      )(request({ ...body, action: "record_health" }))
    ).status,
    422,
  );
  assert.equal(calls, 0);
});

test("passes versioned Gmail action to the canonical command", async () => {
  const seen: Parameters<typeof executeAccountControlCommand>[1][] = [];
  const gmail: typeof executeAccountControlCommand = async (_db, command) => {
    seen.push(command);
    return result;
  };
  const resend: typeof executeResendAccountCommand = async () => result;
  const action = {
    provider: "gmail",
    action: "approve_ramp",
    requestId,
    expectedVersion: 4,
    ramp: 50,
  };
  const run = handler(database(), gmail, resend);
  assert.equal((await run(request(action))).status, 200);
  assert.equal((await run(request(action))).status, 200);
  assert.deepEqual(seen, [
    { type: "approve_ramp", requestId, expectedVersion: 4, ramp: 50 },
    { type: "approve_ramp", requestId, expectedVersion: 4, ramp: 50 },
  ]);
});

test("Resend binding and account identity are server supplied, including replay", async () => {
  const seen: Parameters<typeof executeResendAccountCommand>[1][] = [];
  const gmail: typeof executeAccountControlCommand = async () => result;
  const resend: typeof executeResendAccountCommand = async (_db, command) => {
    seen.push(command);
    return result;
  };
  const configure = {
    provider: "resend",
    action: "configure",
    requestId,
    expectedVersion: 0,
  };
  const response = await handler(database(), gmail, resend)(request(configure));
  assert.equal(response.status, 200);
  assert.doesNotMatch(
    await response.text(),
    /synthetic-send-secret|synthetic-usage-secret/,
  );
  assert.deepEqual(seen[0], {
    type: "resend_configure",
    requestId,
    expectedVersion: 0,
    binding: runtime.binding,
  });
  const priorBinding = { ...runtime.binding, team: "old-team" };
  const replay = handler(
    database({ connectionId, evidence: { binding: priorBinding } }),
    gmail,
    resend,
  );
  assert.equal((await replay(request(configure))).status, 200);
  assert.deepEqual(seen[1], {
    type: "resend_configure",
    requestId,
    expectedVersion: 0,
    binding: priorBinding,
  });
  const halt = {
    provider: "resend",
    action: "halt",
    requestId,
    expectedVersion: 4,
    reason: "Pause for review",
  };
  assert.equal(
    (await handler(database(), gmail, resend)(request(halt))).status,
    200,
  );
  assert.deepEqual(seen[2], {
    type: "halt",
    requestId,
    expectedVersion: 4,
    connectionId,
    reason: "Pause for review",
  });
  assert.equal(
    (
      await handler(
        database(),
        gmail,
        resend,
      )(request({ ...configure, binding: runtime.binding }))
    ).status,
    422,
  );
});

test("returns safe conflicts when the canonical service rejects stale state", async () => {
  const gmail: typeof executeAccountControlCommand = async () => {
    throw new Error("account_version_changed");
  };
  const resend: typeof executeResendAccountCommand = async () => result;
  const response = await handler(
    database(),
    gmail,
    resend,
  )(
    request({
      provider: "gmail",
      action: "activate",
      requestId,
      expectedVersion: 1,
    }),
  );
  assert.equal(response.status, 409);
  assert.match(await response.text(), /account_version_changed/);
});
