import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);

require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const { StaffJourneyOverview } =
  require("./staff-journey-overview") as typeof import("./staff-journey-overview");

test("renders journey and recovery work from staff-scoped overview rows", () => {
  const html = renderToStaticMarkup(
    <StaffJourneyOverview
      journeys={[
        {
          activeCount: 1,
          journeyCount: 2,
          organisationId: "e15bb448-6c67-41f4-ae43-d88a1cf01b86",
          organisationName: "Harbour Foundation",
          recoveryCount: 1,
        },
      ]}
    />,
  );

  assert.match(html, /Draft journeys/);
  assert.match(html, /aria-labelledby="journey-summary-title"/);
  assert.match(html, /Needs attention/);
  assert.match(html, /Harbour Foundation/);
  assert.match(html, /Open workspace/);
});
