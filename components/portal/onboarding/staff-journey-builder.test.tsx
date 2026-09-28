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

const { StaffJourneyBuilder } =
  require("./staff-journey-builder") as typeof import("./staff-journey-builder");

test("renders the scoped draft selections before preparing a welcome", () => {
  const html = renderToStaticMarkup(
    <StaffJourneyBuilder
      agreements={[
        {
          id: "7795e784-a909-45fd-b205-67fb508a181f",
          label: "Website delivery agreement",
          version: 3,
        },
      ]}
      commandEndpoint="/api/portal/admin/clients/org/journey"
      contacts={[
        {
          email: "owner@example.test",
          id: "3d67d9fe-77cb-4c90-869e-f90c2ca799f3",
          name: "Alex Owner",
        },
      ]}
      organisationId="55555555-5555-4555-8555-555555555555"
      templates={[
        {
          id: "13db3b9b-ad10-4641-a11e-42d8e1dd74c8",
          name: "Studio launch",
          version: 1,
        },
      ]}
      welcomePacks={[]}
    />,
  );

  assert.match(html, /Prepare a warm welcome/);
  assert.match(html, /Client agreement/);
  assert.match(html, /Checklist template/);
  assert.match(html, /Preflight/);
});
