import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};
const { OrganisationOnboarding } =
  require("./organisation-onboarding") as typeof import("./organisation-onboarding");

test("organisation onboarding collects only the tenant names required to begin", () => {
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider
      value={{
        bfcacheId: "organisation-onboarding-test",
        back() {},
        forward() {},
        refresh() {},
        push() {},
        replace() {},
        prefetch() {},
      }}
    >
      <OrganisationOnboarding />
    </AppRouterContext.Provider>,
  );
  assert.match(html, /Set up your organisation/);
  assert.match(html, /name="displayName"/);
  assert.match(html, /name="legalName"/);
  assert.match(html, /name="timezone"[^>]*value="Europe\/London"/);
  assert.doesNotMatch(html, /organisationId/);
});
