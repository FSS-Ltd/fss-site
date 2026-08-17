import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};

const { default: GrowthDashboardError } =
  require("@/app/(growth)/(dashboard)/growth/error") as typeof import("@/app/(growth)/(dashboard)/growth/error");
const { default: GrowthDashboardLoading } =
  require("@/app/(growth)/(dashboard)/growth/loading") as typeof import("@/app/(growth)/(dashboard)/growth/loading");

test("renders a fixed, labelled loading state", () => {
  const html = renderToStaticMarkup(<GrowthDashboardLoading />);

  assert.match(html, /aria-busy="true"/);
  assert.match(html, /aria-label="Loading dashboard"/);
  assert.equal((html.match(/metricSkeleton/g) ?? []).length, 3);
});

test("renders a safe error with the server correlation digest", () => {
  const error = Object.assign(
    new Error("postgres password=do-not-render provider payload"),
    { digest: "growth-correlation-123" },
  );
  const html = renderToStaticMarkup(
    <GrowthDashboardError error={error} reset={() => undefined} />,
  );

  assert.match(html, /This view could not be loaded/);
  assert.match(html, /growth-correlation-123/);
  assert.match(html, />Try again<\/button>/);
  assert.doesNotMatch(html, /postgres|password|provider payload/i);
});
