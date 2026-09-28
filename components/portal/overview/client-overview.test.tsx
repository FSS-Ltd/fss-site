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

const { ClientOverview, ClientWorkspaceChooser } =
  require("./client-overview") as typeof import("./client-overview");

test("renders one real request action, the selected review and a project link", () => {
  const html = renderToStaticMarkup(
    <ClientOverview
      canCreateRequest
      workspaceName="Northstar Studio"
      overview={{
        checklist: {
          agreementSigned: true,
          billingReady: true,
          filesReady: true,
          serviceReady: true,
        },
        notifications: [
          {
            body: "A review is ready for your decision.",
            id: "notification-1",
            requestId: "request-1",
            title: "Review requested",
          },
        ],
        organisationId: "organisation-1",
        projects: [
          {
            id: "project-1",
            status: "active",
            summary: "A secure workspace for the team.",
            targetDate: null,
            title: "Member portal",
          },
        ],
        requests: [
          {
            id: "request-1",
            nextAction: "Review the latest delivery.",
            publicSummary: "The booking flow is ready to review.",
            status: "ready_for_review",
            targetDate: null,
            title: "Review booking flow",
          },
        ],
      }}
    />,
  );

  assert.equal((html.match(/>New request</g) ?? []).length, 1);
  assert.match(html, /Review update/);
  assert.equal((html.match(/Review booking flow/g) ?? []).length, 1);
  assert.match(html, /\/projects\/project-1\?organisationId=organisation-1/);
  assert.doesNotMatch(html, /Alex|24 Sep|£2,400/);
});

test("keeps multiple organisation memberships explicit before loading a workspace", () => {
  const html = renderToStaticMarkup(
    <ClientWorkspaceChooser
      memberships={[
        {
          displayName: "Northstar Studio",
          organisationId: "organisation-1",
          role: "owner",
        },
        {
          displayName: "Harbour Foundation",
          organisationId: "organisation-2",
          role: "viewer",
        },
      ]}
    />,
  );

  assert.match(html, /Choose your workspace/);
  assert.match(html, /Northstar Studio/);
  assert.match(html, /Harbour Foundation/);
  assert.match(html, /href="\/\?organisationId=organisation-1"/);
  assert.match(html, /href="\/\?organisationId=organisation-2"/);
});
