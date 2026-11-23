import assert from "node:assert/strict";
import test from "node:test";
import { FounderAuthorizationError } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import { createCampaignCommandHandler } from "./command-route-handler";
import type { executeCampaignCommand } from "./commands";

const founder = { email: "founder@example.com", actorId: "founder" };
const command = {
  type: "approve",
  requestId: "1d76a838-51be-451d-9fe3-02140ab20735",
  campaignId: "5a3a0d16-739c-4271-a7e8-f3b6b78ea345",
  policyVersion: 1,
};
const db = {} as GrowthDb;
function request(body: object, origin = "https://example.com") {
  return new Request("https://example.com/api/growth/campaigns", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
function handler(
  execute: typeof executeCampaignCommand,
  authorizeFounder = async () => founder,
) {
  return createCampaignCommandHandler({
    db,
    config: { origin: "https://example.com" },
    authorizeFounder,
    execute,
    createCorrelationId: () => "correlation",
    reportUnexpectedError: () => {},
  });
}

test("validates origin and founder before executing, and rejects unsupported or forged fields", async () => {
  let calls = 0;
  const execute: typeof executeCampaignCommand = async () => {
    calls++;
    return {
      status: "ok",
      id: command.campaignId,
      version: 1,
      alreadyExisted: false,
    };
  };
  assert.equal(
    (await handler(execute)(request(command, "https://other.example"))).status,
    400,
  );
  assert.equal(
    (
      await handler(execute, async () => {
        throw new FounderAuthorizationError();
      })(request(command))
    ).status,
    401,
  );
  assert.equal(
    (await handler(execute)(request({ ...command, type: "record_outcome" })))
      .status,
    422,
  );
  assert.equal(
    (await handler(execute)(request({ ...command, founder }))).status,
    422,
  );
  assert.equal(calls, 0);
});

test("passes a stable request and authenticated founder through, and reports version conflicts", async () => {
  const seen: unknown[] = [];
  const execute: typeof executeCampaignCommand = async (_db, body, actor) => {
    seen.push({ body, actor });
    return {
      status: "ok",
      id: command.campaignId,
      version: 1,
      alreadyExisted: false,
    };
  };
  const handle = handler(execute);
  assert.equal((await handle(request(command))).status, 200);
  assert.equal((await handle(request(command))).status, 200);
  assert.deepEqual(seen, [
    { body: command, actor: founder },
    { body: command, actor: founder },
  ]);
  const conflict: typeof executeCampaignCommand = async () => {
    throw new Error("policy_version_changed");
  };
  const response = await handler(conflict)(request(command));
  assert.equal(response.status, 409);
  assert.match(await response.text(), /policy_version_changed/);
});
