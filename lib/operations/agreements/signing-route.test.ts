import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const executed: string[] = [];
function stub(path: string, exports: object): void {
  const id = require.resolve(path);
  const cached = new Module(id);
  cached.filename = id;
  cached.loaded = true;
  cached.exports = exports;
  require.cache[id] = cached;
}
stub("../auth/server", {
  getPortalIdentity: async () => ({ email: "signer@example.test" }),
});
stub("../auth/require-admin", {
  requireFssAdmin: async () => ({ realm: "staff" }),
});
stub("../../growth/auth/require-founder", {
  requireFounder: async () => ({ role: "founder" }),
});
stub("../db/client", {
  getOperationsDb: () => ({}),
  operationsEnabled: () => true,
});
stub("../db/portal-client", { getPortalDb: () => ({}) });
stub("../auth/release-flags", { fssStudioEnabled: () => true });
stub("../requests/rate-limit", { consumeRequestRateLimit: async () => true });
stub("./signing-commands", {
  signingEnabled: () => true,
  executeStaffSigningCommand: async () => {
    executed.push("staff");
    return { status: "prepared" };
  },
  executePortalSigningCommand: async () => {
    executed.push("portal");
    return { status: "approved" };
  },
  executeFounderSigningCommand: async () => {
    executed.push("founder");
    return { status: "prepared" };
  },
});

const { staffSigningRoute, portalSigningRoute, founderSigningRoute } =
  require("./signing-route") as typeof import("./signing-route");
const organisationId = "11111111-1111-4111-8111-111111111111";

function request(
  path: string,
  urlOrigin: string,
  headerOrigin: string | null = urlOrigin,
): Request {
  return new Request(`${urlOrigin}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(headerOrigin === null ? {} : { origin: headerOrigin }),
    },
    body: JSON.stringify({ action: "prepare" }),
  });
}

test("signing route wiring separates portal signing from the public-site founder endpoint", async (t) => {
  const oldPortal = process.env.OPERATIONS_PORTAL_ORIGIN;
  const oldSite = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.OPERATIONS_PORTAL_ORIGIN = "https://portal.example.test";
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.example.test";
  t.after(() => {
    if (oldPortal === undefined) delete process.env.OPERATIONS_PORTAL_ORIGIN;
    else process.env.OPERATIONS_PORTAL_ORIGIN = oldPortal;
    if (oldSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = oldSite;
  });

  for (const [name, factory, path, origin, foreign] of [
    [
      "staff",
      staffSigningRoute,
      `/api/portal/admin/clients/${organisationId}/signing`,
      "https://portal.example.test",
      "https://www.example.test",
    ],
    [
      "portal",
      portalSigningRoute,
      `/api/portal/organisations/${organisationId}/signing`,
      "https://portal.example.test",
      "https://www.example.test",
    ],
    [
      "founder",
      founderSigningRoute,
      `/api/growth/operations/clients/${organisationId}/signing`,
      "https://www.example.test",
      "https://portal.example.test",
    ],
  ] as const) {
    await t.test(name, async () => {
      const handler = factory();
      executed.length = 0;
      const response = await handler(request(path, origin), organisationId);
      assert.equal(response.status, 200, await response.text());
      assert.deepEqual(executed, [name]);
      for (const blocked of [
        request(path, origin, foreign),
        request(path, foreign, origin),
        request(path, foreign),
        request(path, origin, null),
        request(path, origin, "null"),
      ]) {
        executed.length = 0;
        assert.equal((await handler(blocked, organisationId)).status, 403);
        assert.deepEqual(executed, []);
      }
    });
  }
});
