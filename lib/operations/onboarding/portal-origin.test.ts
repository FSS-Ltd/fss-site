import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);

test("portal onboarding commands use the portal origin while founder commands keep the site origin", async (t) => {
  const environment = {
    OPERATIONS_ENABLED: "true",
    OPERATIONS_ONBOARDING_ENABLED: "true",
    OPERATIONS_FSS_STUDIO_ENABLED: "true",
    OPERATIONS_PORTAL_ORIGIN: "https://portal.example.test",
    NEXT_PUBLIC_SITE_URL: "https://marketing.example.test",
  };
  for (const [key, value] of Object.entries(environment)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }

  const { staffWelcomePackRoute } =
    require("../http/staff-welcome-pack-route") as typeof import("../http/staff-welcome-pack-route");
  const {
    founderJourneyRoute,
    staffJourneyRoute,
    staffOnboardingRoute,
    staffOnboardingWorkspaceRoute,
  } = require("./route") as typeof import("./route");
  const { portalOnboardingTaskRoute } =
    require("./client-workspace-http") as typeof import("./client-workspace-http");

  const organisationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const portalHandlers = [
    (request: Request) => staffWelcomePackRoute()(request),
    (request: Request) => staffJourneyRoute()(request, organisationId),
    (request: Request) => staffOnboardingRoute()(request, organisationId),
    (request: Request) =>
      staffOnboardingWorkspaceRoute()(request, organisationId),
    (request: Request) => portalOnboardingTaskRoute()(request, organisationId),
  ];

  function request(urlOrigin: string, headerOrigin?: string): Request {
    return new Request(`${urlOrigin}/api/portal/onboarding`, {
      method: "POST",
      headers: headerOrigin ? { origin: headerOrigin } : {},
    });
  }

  for (const handler of portalHandlers) {
    assert.equal(
      (
        await handler(
          request(
            environment.OPERATIONS_PORTAL_ORIGIN,
            environment.OPERATIONS_PORTAL_ORIGIN,
          ),
        )
      ).status,
      415,
      "A portal request should pass the origin check and reach content-type validation.",
    );
    for (const [urlOrigin, headerOrigin] of [
      [environment.OPERATIONS_PORTAL_ORIGIN, environment.NEXT_PUBLIC_SITE_URL],
      [environment.NEXT_PUBLIC_SITE_URL, environment.NEXT_PUBLIC_SITE_URL],
      [environment.OPERATIONS_PORTAL_ORIGIN, "https://forged.example.test"],
      [environment.OPERATIONS_PORTAL_ORIGIN, undefined],
      [environment.OPERATIONS_PORTAL_ORIGIN, "null"],
      ["https://forged.example.test", environment.OPERATIONS_PORTAL_ORIGIN],
    ] as const) {
      assert.equal(
        (await handler(request(urlOrigin, headerOrigin))).status,
        403,
        `${urlOrigin} / ${headerOrigin ?? "missing"}`,
      );
    }
  }

  assert.equal(
    (
      await founderJourneyRoute()(
        request(
          environment.NEXT_PUBLIC_SITE_URL,
          environment.NEXT_PUBLIC_SITE_URL,
        ),
        organisationId,
      )
    ).status,
    415,
  );
  assert.equal(
    (
      await founderJourneyRoute()(
        request(
          environment.OPERATIONS_PORTAL_ORIGIN,
          environment.OPERATIONS_PORTAL_ORIGIN,
        ),
        organisationId,
      )
    ).status,
    403,
  );
});
