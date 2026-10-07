import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};
function stub(path: string, exports: object): void {
  const id = require.resolve(path);
  const cachedModule = new Module(id);
  cachedModule.filename = id;
  cachedModule.loaded = true;
  cachedModule.exports = exports;
  require.cache[id] = cachedModule;
}
const organisationId = "11111111-1111-4111-8111-111111111111";
const context = {
  organisationId,
  identity: {
    userId: organisationId,
    email: "client@example.test",
    emailVerified: true,
  },
};
stub("@/lib/operations/auth/page-context", {
  getPortalPageContext: async () => context,
});
stub("@/lib/operations/agreements/signing-commands", {
  signingEnabled: () => false,
});
stub("@/lib/operations/onboarding/worker-db", {
  onboardingEnabled: () => false,
});
stub("@/lib/operations/billing/configuration", {
  readBillingConfiguration: () => ({ enabled: false }),
});
stub("@/lib/operations/db/portal-client", {
  getPortalDb: () => {
    throw new Error("Disabled features must not query the database");
  },
});

for (const [path, title] of [
  ["./agreements/page", "Your agreements"],
  ["./agreements/[approvalId]/page", "Your agreements"],
  ["./agreements/[approvalId]/sign/page", "Your agreements"],
  ["./agreements/offers/[offerId]/page", "Your agreements"],
  ["./getting-started/page", "Getting started"],
  ["./billing/page", "Billing"],
]) {
  test(`${path} explains a disabled module without a 404 or outage warning`, async () => {
    const { default: Page } = require(path) as {
      default: (props: {
        params: Promise<object>;
        searchParams: Promise<object>;
      }) => Promise<React.JSX.Element>;
    };
    const html = renderToStaticMarkup(
      await Page({
        params: Promise.resolve({
          approvalId: organisationId,
          offerId: organisationId,
        }),
        searchParams: Promise.resolve({ organisationId }),
      }),
    );
    assert.match(html, new RegExp(title));
    assert.match(html, /not available yet/);
    assert.match(html, /Back to workspace/);
    assert.match(html, /Get help/);
    assert.match(html, new RegExp(`organisationId=${organisationId}`));
    assert.doesNotMatch(html, /temporarily unavailable|couldn.t load/);
  });
}
