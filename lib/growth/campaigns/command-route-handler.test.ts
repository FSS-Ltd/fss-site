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

test("create binds approved monthly terms on the server and rejects client-authored authority", async () => {
  const { createHash } = await import("node:crypto");
  const email = "j.ntagengwa@faithfulsoftware.dev";
  const actualFounder = {
    email,
    actorId: createHash("sha256").update(email).digest("hex"),
  };
  const proof = {
    summary: "Evidence reviewed",
    reference: { kind: "private", value: "record-1" },
    observedAt: "2026-11-20T12:00:00Z",
    expiresAt: "2026-12-20T12:00:00Z",
  };
  const editor = {
    offer: "booking_recovery_v1",
    provider: "gmail",
    jurisdiction: "GB",
    permissionRequirement: "consent",
    effectiveAt: "2026-11-20T12:00:00Z",
    expiresAt: "2026-12-20T12:00:00Z",
    ctaA: "May I send details?",
    ctaB: "Could I send details?",
    capability: proof,
    providerEvidence: proof,
    providerConfirmed: true,
    hardBounces: 1,
    complaints: 0,
  };
  const payload = {
    type: "create",
    requestId: command.requestId,
    name: "Test campaign",
    editor,
  };
  let observed: Parameters<typeof executeCampaignCommand>[1] | undefined;
  const execute: typeof executeCampaignCommand = async (_db, body) => {
    observed = body;
    return {
      status: "ok",
      id: command.campaignId,
      version: 1,
      alreadyExisted: false,
    };
  };
  const handle = handler(execute, async () => actualFounder);
  assert.equal((await handle(request(payload))).status, 200);
  assert.ok(observed && observed.type === "create");
  assert.equal(observed.policy.offer, "booking_recovery_v1");
  assert.equal(observed.policy.commercialTerms?.monthlyPence, 49700);
  assert.equal(observed.policy.accountConnectionId, null);
  assert.equal(observed.policy.status, "paused");
  assert.equal(observed.policy.dailyLimit, 25);
  assert.equal(
    (
      await handle(
        request({
          ...payload,
          editor: { ...editor, accountConnectionId: command.campaignId },
        }),
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await handle(
        request({
          ...payload,
          editor: { ...editor, commercialTerms: { monthlyPence: 1 } },
        }),
      )
    ).status,
    422,
  );
});

test("revision rebuilds from the requested stored version and holds unknown stored fields", async () => {
  const { createHash } = await import("node:crypto");
  const { campaignPolicyDefinitionSchema } = await import("./schemas");
  const { serializeCampaignDefinition } = await import("./lifecycle");
  const email = "j.ntagengwa@faithfulsoftware.dev";
  const actualFounder = {
    email,
    actorId: createHash("sha256").update(email).digest("hex"),
  };
  const proof = {
    summary: "Evidence reviewed",
    reference: { kind: "private" as const, value: "record-1" },
    observedAt: "2026-11-20T12:00:00Z",
    expiresAt: "2026-12-20T12:00:00Z",
  };
  const account = "ab331522-9007-4860-b75b-feff19e2d451";
  const stored = serializeCampaignDefinition(
    campaignPolicyDefinitionSchema.parse({
      version: 4,
      accountConnectionId: account,
      offer: "review",
      jurisdiction: "GB",
      capabilityEvidence: proof.reference.value,
      capabilityAttestation: proof,
      providerAttestation: {
        ...proof,
        provider: "gmail",
        jurisdiction: "GB",
        confirmed: true,
      },
      variants: [
        { id: "a", version: 2, cta: "Old A?" },
        { id: "b", version: 2, cta: "Old B?" },
      ],
      cadenceFamily: "review",
      dailyLimit: 50,
    }),
  );
  const editor = {
    offer: "review",
    provider: "gmail",
    jurisdiction: "GB",
    permissionRequirement: "consent",
    effectiveAt: proof.observedAt,
    expiresAt: proof.expiresAt,
    ctaA: "New A?",
    ctaB: "New B?",
    capability: proof,
    providerEvidence: proof,
    providerConfirmed: true,
    hardBounces: 1,
    complaints: 0,
  };
  const payload = {
    type: "revise",
    requestId: command.requestId,
    campaignId: command.campaignId,
    policyVersion: 4,
    editor,
  };
  let storedPolicy: unknown = stored;
  const database = (async () => [
    { policy: storedPolicy },
  ]) as unknown as GrowthDb;
  const bodies: Parameters<typeof executeCampaignCommand>[1][] = [];
  const execute: typeof executeCampaignCommand = async (_db, body) => {
    bodies.push(body);
    return {
      status: "ok",
      id: command.campaignId,
      version: 5,
      alreadyExisted: false,
    };
  };
  const handle = createCampaignCommandHandler({
    db: database,
    config: { origin: "https://example.com" },
    authorizeFounder: async () => actualFounder,
    execute,
    createCorrelationId: () => "correlation",
    reportUnexpectedError: () => {},
  });
  assert.equal((await handle(request(payload))).status, 200);
  assert.equal((await handle(request(payload))).status, 200);
  assert.deepEqual(bodies[0], bodies[1]);
  const revised = bodies[0];
  assert.ok(revised && revised.type === "revise");
  assert.equal(revised.policy.version, 5);
  assert.equal(revised.policy.accountConnectionId, account);
  assert.equal(revised.policy.dailyLimit, 50);
  assert.equal(revised.policy.variants[0]?.version, 3);
  storedPolicy = { ...stored, futureField: "retain me" };
  assert.equal((await handle(request(payload))).status, 409);
  assert.equal(bodies.length, 2);
});
