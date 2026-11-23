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
const { CampaignReplyReview } =
  require("./campaign-reply-review") as typeof import("./campaign-reply-review");
const router = {
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
  bfcacheId: "test",
};
const item = {
  messageId: "message",
  membershipId: "member",
  policyVersion: 1,
  prospectVersion: 2,
  contactVersion: 3,
  receivedAt: "2026-11-22T12:00:00.000Z",
  gmailUrl: "https://mail.google.com/mail/u/0/#all/thread",
  review: null,
};

test("unreviewed reply requires an explicit selection and links to actual thread", () => {
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <CampaignReplyReview
        result={{ status: "ready", items: [item], truncated: false }}
      />
    </AppRouterContext.Provider>,
  );
  assert.match(html, /Open Gmail thread/);
  assert.match(html, /Message bodies are not shown/);
  assert.match(html, /Not reviewed for campaign reporting/);
  assert.match(html, /Choose a classification/);
  assert.match(html, /Opt out/);
  assert.match(html, /disabled=""/);
  assert.doesNotMatch(html, /subject_snapshot|text_snapshot/);
});
test("reviewed and unavailable states are distinct", () => {
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <CampaignReplyReview
        result={{
          status: "ready",
          items: [
            {
              ...item,
              review: {
                kind: "opt_out",
                recordedAt: "2026-11-23T12:00:00.000Z",
              },
            },
          ],
          truncated: false,
        }}
      />
    </AppRouterContext.Provider>,
  );
  assert.match(html, /Reviewed as Opt out/);
  assert.doesNotMatch(html, /Founder classification/);
  const error = renderToStaticMarkup(
    <CampaignReplyReview result={{ status: "unavailable" }} />,
  );
  assert.match(error, /role="alert"/);
});
