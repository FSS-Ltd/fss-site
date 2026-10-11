import assert from "node:assert/strict";
import test from "node:test";
import {
  createStaffSettingsRouteDependencies,
  createStaffSettingsRouteHandler,
} from "./staff-settings-route";
import { defaultActiveStudioSettings } from "../studio/active-settings-types";

const origin = "https://portal.example.test";

test("returns applied typed settings after a Studio section update", async () => {
  const handler = createStaffSettingsRouteHandler({
    authorize: async () => ({ id: "admin" }),
    createCorrelationId: () => "11111111-1111-4111-8111-111111111111",
    enabled: true,
    execute: async () => ({
      ...defaultActiveStudioSettings,
      displayName: "FSS",
      revision: 3,
    }),
    origin,
    reportUnexpectedError: () => undefined,
  });
  const response = await handler(
    new Request("https://portal.example.test/api/portal/admin/settings", {
      body: JSON.stringify({
        section: "identity",
        expectedRevision: 2,
        values: { displayName: "FSS" },
      }),
      headers: { "content-type": "application/json", origin },
      method: "POST",
    }),
  );
  assert.deepEqual(await response.json(), {
    ...defaultActiveStudioSettings,
    displayName: "FSS",
    revision: 3,
  });
});

test("runtime settings saves accept only requests from the configured portal origin", async () => {
  const previousSite = process.env.NEXT_PUBLIC_SITE_URL;
  const previousPortal = process.env.OPERATIONS_PORTAL_ORIGIN;
  const siteOrigin = "https://faithfulsoftware.dev";
  const portalOrigin = "https://portal.example.test";
  process.env.NEXT_PUBLIC_SITE_URL = siteOrigin;
  process.env.OPERATIONS_PORTAL_ORIGIN = portalOrigin;

  try {
    let saves = 0;
    const handler = createStaffSettingsRouteHandler({
      ...createStaffSettingsRouteDependencies(),
      authorize: async () => ({ id: "admin" }),
      enabled: true,
      execute: async () => {
        saves += 1;
        return { ...defaultActiveStudioSettings, revision: 1 };
      },
    });
    const request = (urlOrigin: string, headerOrigin?: string) =>
      new Request(`${urlOrigin}/api/portal/admin/settings`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(headerOrigin ? { origin: headerOrigin } : {}),
        },
        body: JSON.stringify({
          section: "communication",
          expectedRevision: 0,
          values: {
            replyTo: "reply@example.test",
            responseExpectationHours: 48,
          },
        }),
      });

    assert.equal(
      (await handler(request(portalOrigin, portalOrigin))).status,
      200,
    );
    for (const [urlOrigin, headerOrigin] of [
      [siteOrigin, siteOrigin],
      [portalOrigin, siteOrigin],
      [siteOrigin, portalOrigin],
      [portalOrigin, undefined],
    ] as const) {
      assert.equal(
        (await handler(request(urlOrigin, headerOrigin))).status,
        403,
      );
    }
    assert.equal(saves, 1);
  } finally {
    if (previousSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previousSite;
    if (previousPortal === undefined)
      delete process.env.OPERATIONS_PORTAL_ORIGIN;
    else process.env.OPERATIONS_PORTAL_ORIGIN = previousPortal;
  }
});

test("settings conflict returns the applied revision for explicit review, without dropping edits", async () => {
  const { ActiveStudioSettingsConflict } =
    await import("../studio/active-settings");
  const { defaultActiveStudioSettings } =
    await import("../studio/active-settings-types");
  const current = { ...defaultActiveStudioSettings, revision: 7 };
  const handler = createStaffSettingsRouteHandler({
    authorize: async () => ({ id: "admin" }),
    createCorrelationId: () => "11111111-1111-4111-8111-111111111111",
    enabled: true,
    execute: async () => {
      throw new ActiveStudioSettingsConflict(current);
    },
    origin,
    reportUnexpectedError: () =>
      assert.fail("conflicts must not be reported as unexpected errors"),
  });
  const response = await handler(
    new Request(`${origin}/api/portal/admin/settings`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({
        section: "identity",
        expectedRevision: 2,
        values: { displayName: "Retained" },
      }),
    }),
  );
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.deepEqual(body.current, current);
  assert.match(body.error, /retained edits/);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
});
