import assert from "node:assert/strict";
import test from "node:test";
import { FounderAuthorizationError } from "../auth/require-founder";
import { CrmError } from "../crm/errors";
import type { GrowthDb } from "../db/types";
import { createFounderVerificationHandler } from "./founder-verification-route-handler";
import type { verifyFounderEvidence } from "./founder-verification";
const founder = { email: "founder@example.com", actorId: "actor" };
const id = "22ceaa9b-912b-4b59-8c62-69406e775895";
const body = {
  requestId: "c8f19d64-bfbb-4d62-a578-e3f48ea6c435",
  expectedProspectVersion: 4,
  email: "a@example.com",
  firstName: null,
  lastName: null,
  contactSourceUrl: "https://example.com/contact",
  contactObservedAt: "2026-11-23T09:00:00Z",
  observationSourceUrl: "https://example.com/",
  observation: "Appointments are available",
  observedAt: "2026-11-23T09:00:00Z",
};
const request = (payload: object, origin = "https://example.com") =>
  new Request("https://example.com/api", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
const context = { params: Promise.resolve({ id }) };
function handler(
  verify: typeof verifyFounderEvidence,
  authorizeFounder = async () => founder,
) {
  return createFounderVerificationHandler({
    db: {} as GrowthDb,
    config: { origin: "https://example.com" },
    authorizeFounder,
    verify,
    createCorrelationId: () => "ref",
    reportUnexpectedError: () => {},
  });
}

test("requires registered origin, founder, public URLs, explicit ISO times and strict payload", async () => {
  let calls = 0;
  const verify: typeof verifyFounderEvidence = async () => {
    calls++;
    return {
      prospectId: id,
      contactId: id,
      prospectVersion: 5,
      contactVersion: 1,
      alreadyExisted: false,
    };
  };
  assert.equal(
    (await handler(verify)(request(body, "https://other.example"), context))
      .status,
    400,
  );
  assert.equal(
    (
      await handler(verify, async () => {
        throw new FounderAuthorizationError();
      })(request(body), context)
    ).status,
    401,
  );
  for (const invalid of [
    { ...body, founder },
    { ...body, contactSourceUrl: "http://127.0.0.1/x" },
    { ...body, observedAt: "2026-11-23" },
    { ...body, expectedProspectVersion: 0 },
  ])
    assert.equal(
      (await handler(verify)(request(invalid), context)).status,
      422,
    );
  assert.equal(calls, 0);
});

test("uses path prospect and authenticated founder, preserving replay payload and version conflicts", async () => {
  const seen: unknown[] = [];
  const verify: typeof verifyFounderEvidence = async (_db, input, actor) => {
    seen.push({ input, actor });
    return {
      prospectId: id,
      contactId: id,
      prospectVersion: 5,
      contactVersion: 1,
      alreadyExisted: false,
    };
  };
  const run = handler(verify);
  assert.equal((await run(request(body), context)).status, 200);
  assert.equal((await run(request(body), context)).status, 200);
  assert.deepEqual(seen[0], seen[1]);
  assert.equal(
    (seen[0] as { input: { prospectId: string } }).input.prospectId,
    id,
  );
  const conflict: typeof verifyFounderEvidence = async () => {
    throw new CrmError("version_conflict");
  };
  assert.equal((await handler(conflict)(request(body), context)).status, 409);
});
