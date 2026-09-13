import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { PortalAccessRegister } from "@/lib/operations/auth/repository";

const require = createRequire(import.meta.url);

require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};

const { PortalAccessDashboard } =
  require("./portal-access-dashboard") as typeof import("./portal-access-dashboard");

const oneOrganisationRegister = {
  organisations: [
    {
      id: "f26189c9-766c-4c28-bb2d-818556efe397",
      displayName: "Example Client",
    },
  ],
  entries: [],
} satisfies PortalAccessRegister;

const router = {
  bfcacheId: "portal-access-dashboard-test",
  back() {},
  forward() {},
  refresh() {},
  hmrRefresh() {},
  push() {},
  replace() {},
  prefetch() {},
};

test("portal access makes invitation primary and explains the activation sequence", () => {
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <PortalAccessDashboard data={oneOrganisationRegister} />
    </AppRouterContext.Provider>,
  );

  assert.match(
    html,
    /<button[^>]*type="button"[^>]*>[\s\S]*?Invite portal user[\s\S]*?<\/button>/,
  );
  assert.match(
    html,
    /Clerk holds the invitation until the recipient creates their account/,
  );
  assert.match(html, /Account acceptance/);
  assert.match(html, /Portal role/);
  assert.match(html, /Accepted invitations will appear here once account setup is complete/);
});
