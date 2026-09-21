import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { PortalTeamMember } from "@/lib/operations/workspaces/types";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const { ClientTeamWorkspace } =
  require("./client-team-workspace") as typeof import("./client-team-workspace");

const members: readonly PortalTeamMember[] = [
  {
    joinedAt: "2026-09-21T09:00:00.000Z",
    name: "Alex Morgan",
    role: "owner",
  },
];

test("shows the invitation control only to organisation owners", () => {
  const ownerHtml = renderToStaticMarkup(
    <ClientTeamWorkspace
      invitation={<p>Invitation form</p>}
      members={members}
      organisationId="11111111-1111-4111-8111-111111111111"
      role="owner"
    />,
  );
  const viewerHtml = renderToStaticMarkup(
    <ClientTeamWorkspace
      invitation={<p>Invitation form</p>}
      members={members}
      organisationId="11111111-1111-4111-8111-111111111111"
      role="viewer"
    />,
  );

  assert.match(ownerHtml, /Invitation form/);
  assert.doesNotMatch(viewerHtml, /Invitation form/);
  assert.match(
    viewerHtml,
    /Access changes are managed by an organisation owner/,
  );
});
