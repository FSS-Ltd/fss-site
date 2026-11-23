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
  const replacement = "d55a4e25-d712-4d92-b854-7ba22e34fbc7";
  assert.equal(
    (
      await handle(
        request({
          ...payload,
          editor: { ...editor, accountSelection: replacement },
        }),
      )
    ).status,
    200,
  );
  const selected = bodies.at(-1);
  assert.ok(selected && selected.type === "revise");
  assert.equal(selected.policy.accountConnectionId, replacement);
  assert.equal(
    (
      await handle(
        request({
          ...payload,
          editor: { ...editor, accountSelection: "unbound" },
        }),
      )
    ).status,
    200,
  );
  const unbound = bodies.at(-1);
  assert.ok(unbound && unbound.type === "revise");
  assert.equal(unbound.policy.accountConnectionId, null);
  assert.equal(
    (
      await handle(
        request({ ...payload, editor: { ...editor, provider: "resend" } }),
      )
    ).status,
    409,
  );
  storedPolicy = { ...stored, futureField: "retain me" };
  assert.equal((await handle(request(payload))).status, 409);
  assert.equal(bodies.length, 4);
});

test("enrol adapter accepts only an exact founder-approved policy and leaves membership checks to the command", async () => {
  const { createHash } = await import("node:crypto");
  const email = "j.ntagengwa@faithfulsoftware.dev";
  const actualFounder = {
    email,
    actorId: createHash("sha256").update(email).digest("hex"),
  };
  let approved = false;
  const database = (async () =>
    approved ? [{ id: command.campaignId }] : []) as unknown as GrowthDb;
  let calls = 0;
  const execute: typeof executeCampaignCommand = async (_db, input, actor) => {
    calls++;
    assert.equal(input.type, "enrol");
    assert.deepEqual(actor, actualFounder);
    return {
      status: "ok",
      id: command.campaignId,
      version: 1,
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
  const input = {
    type: "enrol",
    requestId: command.requestId,
    campaignId: command.campaignId,
    policyVersion: 1,
    prospectId: "7a71c3fc-4d35-4691-976b-2240fcd08828",
  };
  assert.equal((await handle(request(input))).status, 409);
  assert.equal(calls, 0);
  approved = true;
  assert.equal((await handle(request(input))).status, 200);
  assert.equal((await handle(request(input))).status, 200);
  assert.equal(calls, 2);
});

test("permission adapter derives provider and jurisdiction from the stored membership, with explicit attestation and stable replay", async () => {
  const { createHash } = await import("node:crypto");
  const email = "j.ntagengwa@faithfulsoftware.dev";
  const actualFounder = {
    email,
    actorId: createHash("sha256").update(email).digest("hex"),
  };
  const proof = {
    summary: "Reviewed",
    reference: { kind: "private", value: "proof" },
    observedAt: "2026-11-20T12:00:00Z",
    expiresAt: "2026-12-20T12:00:00Z",
  };
  const policy = {
    version: 2,
    offer: "review",
    jurisdiction: "GB",
    permissionRequirement: "consent",
    capabilityEvidence: "proof",
    capabilityAttestation: proof,
    providerAttestation: {
      ...proof,
      provider: "gmail",
      jurisdiction: "GB",
      confirmed: true,
    },
  };
  const database = (async () => [
    { version: 2, country: "GB", policy },
  ]) as unknown as GrowthDb;
  const seen: Parameters<typeof executeCampaignCommand>[1][] = [];
  const execute: typeof executeCampaignCommand = async (_db, input) => {
    seen.push(input);
    return {
      status: "ok",
      id: command.requestId,
      version: 2,
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
  const input = {
    type: "record_permission",
    requestId: command.requestId,
    membershipId: command.campaignId,
    expectedPolicyVersion: 2,
    expectedProspectVersion: 4,
    expectedContactVersion: 3,
    proofRequestId: "7a71c3fc-4d35-4691-976b-2240fcd08828",
    summary: "Recipient opted in",
    reference: { kind: "private", value: "signed-record" },
    observedAt: proof.observedAt,
    expiresAt: proof.expiresAt,
    attestation: { kind: "consent", explicitOptIn: true },
  };
  assert.equal((await handle(request(input))).status, 200);
  assert.equal((await handle(request(input))).status, 200);
  assert.deepEqual(seen[0], seen[1]);
  const saved = seen[0];
  assert.ok(saved && saved.type === "record_permission");
  assert.equal(saved.provider, "gmail");
  assert.equal(saved.jurisdiction, "GB");
  assert.equal(saved.evidenceId, input.requestId);
  assert.equal(saved.proofRequestId, input.proofRequestId);
  assert.equal(
    (await handle(request({ ...input, provider: "resend" }))).status,
    422,
  );
  assert.equal(
    (
      await handle(
        request({
          ...input,
          attestation: { kind: "consent", explicitOptIn: false },
        }),
      )
    ).status,
    422,
  );
  assert.equal(
    (await handle(request({ ...input, observedAt: "2026-11-20" }))).status,
    422,
  );
  assert.equal(
    (
      await handle(
        request({
          ...input,
          attestation: {
            kind: "requested_service",
            requestedAt: proof.observedAt,
            attestsRecipientRequest: true,
            messageScope: "initial_and_two_followups",
          },
        }),
      )
    ).status,
    409,
  );
});

test("requested-service permission requires explicit scope and binds the stored offer", async () => {
  const { createHash } = await import("node:crypto");
  const email = "j.ntagengwa@faithfulsoftware.dev";
  const actualFounder = {
    email,
    actorId: createHash("sha256").update(email).digest("hex"),
  };
  const proof = {
    summary: "Reviewed",
    reference: { kind: "private", value: "proof" },
    observedAt: "2026-11-20T12:00:00Z",
    expiresAt: "2026-12-20T12:00:00Z",
  };
  const policy = {
    version: 2,
    offer: "review",
    jurisdiction: "GB",
    permissionRequirement: "requested_service",
    capabilityEvidence: "proof",
    capabilityAttestation: proof,
    providerAttestation: {
      ...proof,
      provider: "gmail",
      jurisdiction: "GB",
      confirmed: true,
    },
  };
  const db = (async () => [{ version: 2, policy }]) as unknown as GrowthDb;
  let saved: Parameters<typeof executeCampaignCommand>[1] | undefined;
  const execute: typeof executeCampaignCommand = async (_db, input) => {
    saved = input;
    return {
      status: "ok",
      id: command.requestId,
      version: 2,
      alreadyExisted: false,
    };
  };
  const handle = createCampaignCommandHandler({
    db,
    config: { origin: "https://example.com" },
    authorizeFounder: async () => actualFounder,
    execute,
    createCorrelationId: () => "ref",
    reportUnexpectedError: () => {},
  });
  const input = {
    type: "record_permission",
    requestId: command.requestId,
    membershipId: command.campaignId,
    expectedPolicyVersion: 2,
    expectedProspectVersion: 4,
    expectedContactVersion: 3,
    proofRequestId: "7a71c3fc-4d35-4691-976b-2240fcd08828",
    summary: "Recipient asked for the review service",
    reference: { kind: "public", value: "https://example.com/request" },
    observedAt: proof.observedAt,
    expiresAt: proof.expiresAt,
    attestation: {
      kind: "requested_service",
      requestedAt: proof.observedAt,
      attestsRecipientRequest: true,
      messageScope: "initial_and_two_followups",
    },
  };
  assert.equal((await handle(request(input))).status, 200);
  assert.ok(saved && saved.type === "record_permission");
  assert.equal(saved.requestedService?.offerId, "review");
  assert.equal(saved.explicitOptIn, false);
  assert.equal(
    (
      await handle(
        request({
          ...input,
          attestation: { ...input.attestation, attestsRecipientRequest: false },
        }),
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await handle(
        request({
          ...input,
          reference: { kind: "public", value: "http://127.0.0.1/" },
        }),
      )
    ).status,
    422,
  );
});
