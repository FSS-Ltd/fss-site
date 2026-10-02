import assert from "node:assert/strict";
import test from "node:test";
import { AgreementBuilderDraftValidationError } from "../agreements/builder-draft-validation";
import {
  createStaffAgreementDraftRouteDependencies,
  createStaffAgreementDraftRouteHandler,
} from "./staff-agreement-draft-route";

const origin = "https://portal.example.test";
const organisationId = "44444444-4444-4444-8444-444444444444";
const draftId = "55555555-5555-4555-8555-555555555555";

const draftInput = {
  action: "save",
  content: {},
  draftId,
  expectedVersion: 0,
  step: "link",
};

function request(urlOrigin: string, requestOrigin?: string): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (requestOrigin !== undefined) headers.set("origin", requestOrigin);
  return new Request(
    `${urlOrigin}/api/portal/admin/clients/${organisationId}/agreement-drafts`,
    { body: JSON.stringify(draftInput), headers, method: "POST" },
  );
}

async function withEnvironment<T>(
  values: Readonly<Record<string, string | undefined>>,
  run: () => Promise<T>,
): Promise<T> {
  const original = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function runtimeHandler(
  execute: () => Promise<{ id: string; version: number }>,
) {
  const dependencies = createStaffAgreementDraftRouteDependencies();
  return createStaffAgreementDraftRouteHandler({
    ...dependencies,
    authorize: async () => ({ id: "admin" }),
    enabled: true,
    execute: async () => execute(),
  });
}

test("runtime draft saves accept the configured portal origin rather than the website origin", async () => {
  await withEnvironment(
    {
      NEXT_PUBLIC_SITE_URL: "https://faithfulsoftware.dev",
      OPERATIONS_PORTAL_ORIGIN: undefined,
    },
    async () => {
      let executed = 0;
      const handler = runtimeHandler(async () => {
        executed += 1;
        return { id: draftId, version: 1 };
      });

      const response = await handler(
        request(
          "https://portal.faithfulsoftware.dev",
          "https://portal.faithfulsoftware.dev",
        ),
        organisationId,
      );
      assert.equal(response.status, 200);
      assert.equal(executed, 1);

      const wrongOrigin = await handler(
        request("https://faithfulsoftware.dev", "https://faithfulsoftware.dev"),
        organisationId,
      );
      assert.equal(wrongOrigin.status, 403);
      assert.equal(executed, 1);
    },
  );
});

test("runtime draft saves honor a custom portal origin and reject missing or forged origins", async () => {
  const portalOrigin = "https://studio.example.test";
  await withEnvironment(
    {
      NEXT_PUBLIC_SITE_URL: "https://faithfulsoftware.dev",
      OPERATIONS_PORTAL_ORIGIN: portalOrigin,
    },
    async () => {
      let executed = 0;
      const handler = runtimeHandler(async () => {
        executed += 1;
        return { id: draftId, version: 1 };
      });

      assert.equal(
        (await handler(request(portalOrigin, portalOrigin), organisationId))
          .status,
        200,
      );
      assert.equal(executed, 1);

      for (const invalidRequest of [
        request(portalOrigin),
        request(portalOrigin, "https://attacker.example"),
        request("https://attacker.example", portalOrigin),
      ]) {
        assert.equal(
          (await handler(invalidRequest, organisationId)).status,
          403,
        );
      }
      assert.equal(executed, 1);
    },
  );
});

test("staff agreement draft route binds a save to the organisation selected by the URL", async () => {
  let executedOrganisationId: string | null = null;
  const handler = createStaffAgreementDraftRouteHandler({
    authorize: async () => ({ id: "admin" }),
    createCorrelationId: () => "11111111-1111-4111-8111-111111111111",
    enabled: true,
    execute: async (_admin, selectedOrganisationId, input) => {
      executedOrganisationId = selectedOrganisationId;
      return {
        content: input,
        id: "55555555-5555-4555-8555-555555555555",
        step: "link" as const,
        version: 1,
      };
    },
    origin,
    reportUnexpectedError: () => undefined,
  });

  const response = await handler(
    new Request(
      `https://portal.example.test/api/portal/admin/clients/${organisationId}/agreement-drafts`,
      {
        body: JSON.stringify({
          action: "save",
          content: {},
          draftId: "55555555-5555-4555-8555-555555555555",
          expectedVersion: 0,
          step: "link",
        }),
        headers: { "content-type": "application/json", origin },
        method: "POST",
      },
    ),
    organisationId,
  );

  assert.equal(response.status, 200);
  assert.equal(executedOrganisationId, organisationId);
  assert.deepEqual(await response.json(), {
    content: {
      action: "save",
      content: {},
      draftId: "55555555-5555-4555-8555-555555555555",
      expectedVersion: 0,
      step: "link",
    },
    id: "55555555-5555-4555-8555-555555555555",
    step: "link",
    version: 1,
  });
});

test("creation failures identify the operation and log only safe diagnostics", async () => {
  const reports: unknown[] = [];
  const handler = createStaffAgreementDraftRouteHandler({
    authorize: async () => ({ id: "admin" }),
    createCorrelationId: () => "11111111-1111-4111-8111-111111111111",
    enabled: true,
    execute: async () => {
      throw Object.assign(new Error("private contact and agreement contents"), {
        code: "42501",
      });
    },
    origin,
    reportUnexpectedError: (report) => reports.push(report),
  });
  const response = await handler(
    new Request(
      `${origin}/api/portal/admin/clients/${organisationId}/agreement-drafts`,
      {
        body: JSON.stringify({ action: "finalise" }),
        headers: { "content-type": "application/json", origin },
        method: "POST",
      },
    ),
    organisationId,
  );
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error:
      "We could not create this agreement. Your saved draft is still available. Please try again.",
  });
  assert.deepEqual(reports, [
    {
      correlationId: "11111111-1111-4111-8111-111111111111",
      errorName: "Error",
      errorCode: "42501",
      operation: "finalise",
    },
  ]);
});

test("unexpected diagnostics discard untrusted error codes and action values", async () => {
  const reports: unknown[] = [];
  const handler = createStaffAgreementDraftRouteHandler({
    authorize: async () => ({ id: "admin" }),
    createCorrelationId: () => "11111111-1111-4111-8111-111111111111",
    enabled: true,
    execute: async () => {
      throw { code: "secret@example.test" };
    },
    origin,
    reportUnexpectedError: (report) => reports.push(report),
  });
  await handler(
    new Request(`${origin}/agreement-drafts`, {
      body: JSON.stringify({ action: "private agreement" }),
      headers: { "content-type": "application/json", origin },
      method: "POST",
    }),
    organisationId,
  );
  assert.deepEqual(reports, [
    {
      correlationId: "11111111-1111-4111-8111-111111111111",
      errorName: "UnknownError",
      errorCode: "UNKNOWN",
      operation: "unknown",
    },
  ]);
});

test("draft validation returns actionable stage issues without unexpected-error reporting", async () => {
  const issues = [
    {
      step: "fees" as const,
      message: "Fees: Add a recurring service or choose fixed payment.",
    },
  ];
  let reports = 0;
  const handler = createStaffAgreementDraftRouteHandler({
    authorize: async () => ({ id: "admin" }),
    createCorrelationId: () => "11111111-1111-4111-8111-111111111111",
    enabled: true,
    execute: async () => {
      throw new AgreementBuilderDraftValidationError(issues);
    },
    origin,
    reportUnexpectedError: () => {
      reports += 1;
    },
  });
  const response = await handler(request(origin, origin), organisationId);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: issues[0].message, issues });
  assert.equal(reports, 0);
});
