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

const { StudioProjectForm } =
  require("./project-form") as typeof import("./project-form");

test("keeps public project details distinct from internal delivery notes", () => {
  const html = renderToStaticMarkup(
    <StudioProjectForm
      project={{
        agreementId: "44444444-4444-4444-8444-444444444444",
        deliverables: ["Website"],
        id: "55555555-5555-4555-8555-555555555555",
        internalEstimateMinutes: 120,
        internalNotes: "Private delivery planning",
        milestones: [],
        organisationId: "66666666-6666-4666-8666-666666666666",
        outcome: "Clearer enquiries",
        ownerDisplay: "Jean-Fidele",
        scheduleDependencies: [],
        scheduleEvidence: null,
        status: "active",
        summary: "A clearer website experience.",
        targetDate: null,
        title: "Website refresh",
        version: 3,
        visibility: "client",
      }}
    />,
  );

  assert.match(html, /Public project details/);
  assert.match(html, /Client presentation preview/);
  assert.match(html, /Internal delivery notes/);
  assert.match(html, /Save project/);
  assert.match(html, /A clearer website experience/);
  const clientPreview = html.slice(
    html.indexOf("Client presentation preview"),
    html.indexOf("Internal delivery notes"),
  );
  assert.doesNotMatch(clientPreview, /Private delivery planning/);
});
