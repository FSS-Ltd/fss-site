import assert from "node:assert/strict";
import test from "node:test";
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
