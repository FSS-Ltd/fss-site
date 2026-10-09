import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { StudioPortalAccessEntry } from "@/lib/operations/studio/portal-access";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};
const { AccessIdentityCard } =
  require("./access-identity-card") as typeof import("./access-identity-card");

const entry: StudioPortalAccessEntry = {
  accessType: "client",
  contactId: null,
  email: "client@example.test",
  expiresAt: "2026-10-12T10:00:00Z",
  id: "client-invitation:44444444-4444-4444-8444-444444444444",
  invitedAt: "2026-10-09T10:00:00Z",
  joinedAt: null,
  lastVerifiedAt: null,
  membershipId: null,
  name: "Client Example",
  organisationId: "55555555-5555-4555-8555-555555555555",
  organisationName: "Test client",
  role: "viewer",
  state: "pending",
};

function render(
  entryToShow: StudioPortalAccessEntry,
  canManageStaff = false,
): string {
  return renderToStaticMarkup(
    <AccessIdentityCard
      canManageStaff={canManageStaff}
      entry={entryToShow}
      onComplete={() => undefined}
      timezone="Europe/London"
    />,
  );
}

test("current pending and expired client invitations offer a reviewed resend", () => {
  for (const state of ["pending", "expired"] as const) {
    const html = render({ ...entry, state });
    assert.match(html, /Resend invitation/);
    assert.match(html, /Review reference/);
    assert.match(html, /30 days/);
  }
});

test("staff resend is founder-only and older or closed invitations have no resend", () => {
  const staff: StudioPortalAccessEntry = {
    ...entry,
    accessType: "admin",
    id: "staff:44444444-4444-4444-8444-444444444444",
    organisationId: null,
    organisationName: "FSS",
    role: "admin",
  };
  assert.doesNotMatch(render(staff), /Resend invitation/);
  assert.match(render(staff, true), /Resend invitation/);
  assert.doesNotMatch(
    render({ ...entry, state: "declined" }),
    /Resend invitation/,
  );
  assert.doesNotMatch(
    render({ ...entry, state: "revoked" }),
    /Resend invitation/,
  );
  assert.doesNotMatch(
    render({
      ...entry,
      id: "legacy-invitation:44444444-4444-4444-8444-444444444444",
    }),
    /Resend invitation/,
  );
});
