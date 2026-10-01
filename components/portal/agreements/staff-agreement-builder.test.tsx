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

const { StaffAgreementBuilder } =
  require("./staff-agreement-builder") as typeof import("./staff-agreement-builder");

const organisationId = "11111111-1111-4111-8111-111111111111";
const engagementId = "22222222-2222-4222-8222-222222222222";

function renderBuilder(
  engagements: readonly { id: string; name: string }[],
  initialDraft: Parameters<
    typeof StaffAgreementBuilder
  >[0]["initialDraft"] = null,
) {
  return renderToStaticMarkup(
    <StaffAgreementBuilder
      baseHref={`/portal/admin/clients/${organisationId}/agreements/new`}
      commandEndpoint={`/api/portal/admin/clients/${organisationId}/agreement-drafts`}
      engagementHref={`/portal/admin/clients/${organisationId}/engagements/new`}
      engagements={engagements}
      initialDraft={initialDraft}
      onNavigate={() => undefined}
      organisationName="Northstar Studio"
    />,
  );
}

test("the link step presents reviewed work and a saved-draft continuation", () => {
  const html = renderBuilder([
    {
      id: engagementId,
      name: "Website & booking experience · Discovery complete",
    },
  ]);

  assert.match(html, /Link the right work/);
  assert.match(html, /Discovery complete/);
  assert.match(html, /Continue to scope/);
  assert.doesNotMatch(html, /New agreement<\/legend>/);
});

test("the no-engagement state preserves the draft and directs users to reviewed work", () => {
  const html = renderBuilder([]);

  assert.match(html, /No engagement is linked/);
  assert.match(html, /Your draft stays saved/);
  assert.match(html, /Create engagement/);
  assert.doesNotMatch(html, /<option value="[0-9a-f-]{36}/);
});

test("a server-loaded saved draft opens at its persisted builder step", () => {
  const html = renderBuilder([], {
    content: {
      agreement: {
        goals: "Make booking easier.",
        responsibilities: "Supply approved copy.",
        scope: "Build the booking flow.",
        support: "Support follows the agreed term.",
        terms: "Customer accounts are not included.",
      },
      engagementId,
    },
    createdAt: "2026-09-21T18:00:00.000Z",
    engagementId,
    id: "33333333-3333-4333-8333-333333333333",
    organisationId,
    step: "scope",
    updatedAt: "2026-09-21T18:05:00.000Z",
    version: 2,
  });

  assert.match(html, /Define the work/);
  assert.match(html, /Continue to fees/);
  assert.doesNotMatch(html, /Link the right work/);
});

test("the review step does not claim that creating an agreement also prepares signing", () => {
  const html = renderBuilder([], {
    content: {
      agreement: { title: "Website & booking experience" },
      engagementId,
    },
    createdAt: "2026-09-21T18:00:00.000Z",
    engagementId,
    id: "33333333-3333-4333-8333-333333333333",
    organisationId,
    step: "review",
    updatedAt: "2026-09-21T18:05:00.000Z",
    version: 2,
  });

  assert.match(html, />Create agreement</);
  assert.doesNotMatch(html, /Create agreement &amp; prepare signing/);
});
