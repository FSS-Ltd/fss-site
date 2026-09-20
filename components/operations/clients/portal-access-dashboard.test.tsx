import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import {
  getFounderAccessMetrics,
  type FounderAccessOverview,
} from "@/lib/operations/auth/founder-access";

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
  metrics: getFounderAccessMetrics([], 1),
  entries: [],
  filters: { query: "" },
  page: 1,
  hasNext: false,
} satisfies FounderAccessOverview;

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
  assert.match(html, /Unique active users/);
  assert.match(html, /Active FSS Admins/);
  assert.match(html, /Pending invitations/);
  assert.match(html, /Portal role/);
  assert.match(html, /No access records match this view/);
});

test("portal access keeps the invitation action visible before an organisation exists", () => {
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <PortalAccessDashboard
        data={{
          metrics: getFounderAccessMetrics([], 0),
          entries: [],
          filters: { query: "" },
          page: 1,
          hasNext: false,
        }}
      />
    </AppRouterContext.Provider>,
  );

  assert.match(html, /class="primaryAction"/);
  assert.match(html, /Invite portal user/);
  assert.doesNotMatch(html, /Create an active organisation/);
  assert.match(html, /FSS Admin/);
  assert.match(html, /Search users/);
  assert.match(html, /All states and history/);
});
