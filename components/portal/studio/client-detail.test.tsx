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

const { StudioClientDetail } =
  require("./client-detail") as typeof import("./client-detail");

test("renders a selected client hub with server-owned workspace destinations", () => {
  const html = renderToStaticMarkup(
    <StudioClientDetail
      client={{
        activeJourneyCount: 1,
        activeProjectCount: 1,
        agreementCount: 1,
        billingExceptionCount: 0,
        displayName: "Northstar Studio",
        id: "44444444-4444-4444-8444-444444444444",
        legalName: "Northstar Studio Ltd",
        lifecycle: "active",
        nextAction: "Review client work",
        nextActionHref:
          "/portal/admin/clients/44444444-4444-4444-8444-444444444444/requests",
        openRequestCount: 2,
        primaryContactName: "Alex Morgan",
        timezone: "Europe/London",
      }}
    />,
  );

  assert.match(html, /Northstar Studio/);
  assert.match(html, /Review client work/);
  assert.match(html, /People &amp; access/);
  assert.match(html, /Open agreements/);
  assert.match(html, /Open projects/);
  assert.match(
    html,
    /organisationId=44444444-4444-4444-8444-444444444444/,
  );
});
