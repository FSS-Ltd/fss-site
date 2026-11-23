import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ProspectOutcomes } from "@/lib/growth/dashboard/prospect-campaign-outcomes";
const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};
const { CampaignOutcomeReview } =
  require("./campaign-outcome-review") as typeof import("./campaign-outcome-review");
const router = {
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
  bfcacheId: "test",
};
const result: ProspectOutcomes = {
  status: "ready",
  memberships: [
    {
      id: "membership",
      campaign: "Campaign",
      policyVersion: 1,
      prospectVersion: 2,
      contactVersion: 3,
      submittedAt: "2026-11-20T12:00:00Z",
    },
  ],
  meetings: [
    {
      id: "12345678-meeting",
      recordedAt: "2026-11-21T12:00:00Z",
      attributed: true,
    },
  ],
  proposals: [
    {
      id: "12345678-proposal",
      engagementId: "engagement",
      recordedAt: "2026-11-22T12:00:00Z",
      attributed: false,
    },
  ],
  truncated: false,
};
function render(value: ProspectOutcomes) {
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <CampaignOutcomeReview result={value} />
    </AppRouterContext.Provider>,
  );
}
test("requires an explicit qualified meeting and shows attributed records", () => {
  const html = render(result);
  assert.match(html, /proposal stage alone does not confirm delivery/);
  assert.match(html, /already attributed/);
  assert.match(html, /I confirm this meeting took place and was qualified/);
  assert.match(html, /Record campaign outcome/);
  assert.doesNotMatch(html, /paid/);
});
test("distinguishes missing evidence and unavailable review", () => {
  assert.match(
    render({ ...result, memberships: [] }),
    /No campaign with confirmed outreach/,
  );
  assert.match(
    render({ ...result, meetings: [], proposals: [] }),
    /No meeting activity or proposal stage/,
  );
  assert.match(render({ status: "unavailable" }), /unavailable/);
});
