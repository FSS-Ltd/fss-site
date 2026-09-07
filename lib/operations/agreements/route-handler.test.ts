import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  createAgreementRouteHandler,
  type AgreementRouteDependencies,
} from "./route-handler";
import { AgreementConflict, type AgreementRecord } from "./types";
import { agreementDraft } from "./fixtures";

const organisationId = randomUUID();
const correlationId = randomUUID();
const founder = { actorId: "a".repeat(64) };
const record: AgreementRecord = {
  id: randomUUID(),
  engagementId: randomUUID(),
  version: 1,
  revision: 1,
  status: "draft",
  draft: agreementDraft(),
  evidence: null,
  services: [],
};
function setup(overrides: Partial<AgreementRouteDependencies> = {}) {
  const reports: { correlationId: string; errorName: string }[] = [];
  let writes = 0;
  const handler = createAgreementRouteHandler({
    enabled: true,
    origin: "https://example.test",
    authorizeFounder: async () => founder,
    execute: async (actor, id, body, correlation) => {
      writes++;
      assert.deepEqual(actor, founder);
      assert.equal(id, organisationId);
      assert.equal(correlation, correlationId);
      assert.deepEqual(body, { action: "test" });
      return record;
    },
    createCorrelationId: () => correlationId,
    reportUnexpectedError: (report) => reports.push(report),
    ...overrides,
  });
  return { handler, reports, writes: () => writes };
}
function request(
  body = JSON.stringify({ action: "test" }),
  origin = "https://example.test",
) {
  return new Request("https://example.test/api/test", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body,
  });
}
test("agreement endpoint authorizes and bounds requests before writes", async () => {
  for (const scenario of [
    { overrides: { enabled: false }, status: 404 },
    {
      overrides: {
        authorizeFounder: async () => {
          throw new Error("denied");
        },
      },
      status: 403,
    },
  ]) {
    const api = setup(scenario.overrides);
    assert.equal(
      (await api.handler(request(), organisationId)).status,
      scenario.status,
    );
    assert.equal(api.writes(), 0);
  }
  const api = setup();
  for (const [input, id, status] of [
    [request("{}", "https://attacker.test"), organisationId, 403],
    [request(), "bad-id", 422],
    [request("{"), organisationId, 400],
    [request("x".repeat(65537)), organisationId, 413],
  ] as const) {
    assert.equal((await api.handler(input, id)).status, status);
  }
  assert.equal(api.writes(), 0);
  const response = await api.handler(request(), organisationId);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-correlation-id"), correlationId);
  assert.deepEqual(await response.json(), { record });
});
test("agreement endpoint maps conflicts and validation without exposing database details", async () => {
  const validation = z.strictObject({ title: z.string() }).safeParse({});
  assert.equal(validation.success, false);
  for (const [error, status] of [
    [new AgreementConflict(), 409],
    [validation.error, 422],
    [{ code: "23503", detail: "private database detail" }, 422],
    [new Error("secret database URL"), 500],
    ["secret", 500],
  ] as const) {
    const api = setup({
      execute: async () => {
        throw error;
      },
    });
    const response = await api.handler(request(), organisationId);
    assert.equal(response.status, status);
    assert.doesNotMatch(
      await response.text(),
      /secret|private database detail/,
    );
    assert.equal(api.reports.length, status === 500 ? 1 : 0);
    if (status === 500)
      assert.deepEqual(api.reports[0], {
        correlationId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
  }
});
