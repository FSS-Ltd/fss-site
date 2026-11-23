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
          verification: {
            status: "current",
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
