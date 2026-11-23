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
const { CampaignReview } =
  require("./campaign-review") as typeof import("./campaign-review");
const router = {
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
  bfcacheId: "test",
};

test("current verified evidence and approved campaign remain explicitly review only", () => {
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <CampaignReview
        prospectId="x"
        version={4}
        contact={null}
        result={{
          status: "ready",
          reviewStatus: "available",
          membership: null,
          verification: {
            status: "current",
            requestId: "c8f19d64-bfbb-4d62-a578-e3f48ea6c435",
            contactVersion: 1,
            prospectVersion: 4,
            email: "person@example.com",
            observation: "Offers bookings",
            contactSourceUrl: "https://example.com/contact",
            contactObservedAt: "2026-11-22T09:00:00.000Z",
            observationSourceUrl: "https://example.com/",
            observedAt: "2026-11-22T09:00:00.000Z",
            freshUntil: "2026-12-22T09:00:00.000Z",
          },
          campaigns: [
            {
              id: "c",
              name: "Campaign",
              version: 2,
              offer: "review",
              status: "paused",
            },
          ],
          truncated: false,
        }}
      />
    </AppRouterContext.Provider>,
  );
  assert.match(html, /Current founder-verified evidence/);
  assert.match(html, /Public contact details are not consent/);
  assert.match(html, /version 2/);
  assert.match(html, /review record only/);
  assert.doesNotMatch(html, /Send now/);
});

test("stale evidence and failures do not expose enrolment", () => {
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <CampaignReview
        prospectId="x"
        version={1}
        contact={null}
        result={{
          status: "ready",
          reviewStatus: "available",
          membership: null,
          verification: null,
          campaigns: [
            {
              id: "c",
              name: "Campaign",
              version: 2,
              offer: "review",
              status: "approved",
            },
          ],
          truncated: false,
        }}
      />
    </AppRouterContext.Provider>,
  );
  assert.match(html, /Verify current source evidence/);
  assert.doesNotMatch(html, /Add for review/);
});

test("permission capture requires explicit opt-in and shows recorded job state", () => {
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <CampaignReview
        prospectId="x"
        version={4}
        contact={null}
        result={{
          status: "ready",
          reviewStatus: "already_in_outreach",
          verification: {
            status: "current",
            requestId: "c8f19d64-bfbb-4d62-a578-e3f48ea6c435",
            contactVersion: 3,
            prospectVersion: 4,
            email: "person@example.com",
            observation: "Offers bookings",
            contactSourceUrl: "https://example.com/contact",
            contactObservedAt: "2026-11-22T09:00:00.000Z",
            observationSourceUrl: "https://example.com/",
            observedAt: "2026-11-22T09:00:00.000Z",
            freshUntil: "2026-12-22T09:00:00.000Z",
          },
          membership: {
            id: "m",
            campaignName: "Campaign",
            policyVersion: 2,
            status: "review",
            provider: "gmail",
            jurisdiction: "GB",
            basis: "consent",
            offer: "review",
            canRecord: true,
            permissionExpiresAt: "2026-12-22T09:00:00.000Z",
            preparation: { status: "held", reason: "permission_invalid" },
          },
          campaigns: [],
          truncated: false,
        }}
      />
    </AppRouterContext.Provider>,
  );
  assert.match(html, /Preparation job: held/);
  assert.match(html, /permission invalid/);
  assert.match(html, /recipient explicitly opted in/);
  assert.match(html, /type="checkbox"[^>]*required/);
  assert.doesNotMatch(html, /type="checkbox"[^>]*checked/);
  assert.match(html, /contact details, not permission/);
});
