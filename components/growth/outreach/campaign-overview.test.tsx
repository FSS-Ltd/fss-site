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
const { CampaignOverview } =
  require("./campaign-overview") as typeof import("./campaign-overview");

test("shows observed counts and a stored hold reason without claiming delivery", () => {
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider
      value={{
        back() {},
        forward() {},
        refresh() {},
        push() {},
        replace() {},
        prefetch() {},
        bfcacheId: "test",
      }}
    >
      <CampaignOverview
        result={{
          status: "ready",
          londonDate: "23 November 2026",
          truncated: false,
          rows: [
            {
              id: "one",
              name: "Local campaign",
              version: 2,
              status: "approved",
              approved: true,
              offer: "Monthly terms unavailable",
              prepared: 2,
              held: 1,
              attempts: 1,
              accepted: 1,
              confirmed: 0,
              holdReason: "permission_invalid",
              reportDue: null,
              reportStatus: null,
            },
          ],
        }}
      />
    </AppRouterContext.Provider>,
  );
  assert.match(html, /Pause campaign/);
  assert.match(html, /Local campaign/);
  assert.match(html, /permission invalid/);
  assert.match(html, /Confirmed today<\/dt><dd>0/);
  assert.match(html, /delivery are unavailable/);
  assert.doesNotMatch(html, />Running</);
});

test("shows distinct empty and error states", () => {
  const empty = renderToStaticMarkup(
    <CampaignOverview
      result={{
        status: "ready",
        londonDate: "23 November 2026",
        truncated: false,
        rows: [],
      }}
    />,
  );
  assert.match(empty, /No campaigns have been created yet/);
  const error = renderToStaticMarkup(
    <CampaignOverview result={{ status: "error", reference: "reference-1" }} />,
  );
  assert.match(error, /role="alert"/);
  assert.match(error, /reference-1/);
});
