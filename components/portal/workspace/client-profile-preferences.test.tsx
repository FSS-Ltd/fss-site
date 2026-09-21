import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { PortalProfile } from "@/lib/operations/auth/user-profile";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const { ClientProfilePreferences } =
  require("./client-profile-preferences") as typeof import("./client-profile-preferences");

const profile: PortalProfile = {
  displayName: "Alex Morgan",
  email: "alex@northstar.example",
  organisationName: "Northstar Ltd",
  requestEmailEnabled: true,
  role: "owner",
  timezone: "Europe/London",
};

test("keeps verified identity and organisation controls separate from profile editing", () => {
  const html = renderToStaticMarkup(
    <ClientProfilePreferences
      organisationId="11111111-1111-4111-8111-111111111111"
      profile={profile}
    />,
  );

  assert.match(html, /Alex Morgan/);
  assert.match(html, /alex@northstar\.example/);
  assert.match(html, /Europe\/London/);
  assert.match(html, /Essential account messages/);
  assert.match(html, /<input[^>]*readOnly[^>]*type="email"/);
});

test("does not expose a profile save control to a view-only member", () => {
  const html = renderToStaticMarkup(
    <ClientProfilePreferences
      organisationId="11111111-1111-4111-8111-111111111111"
      profile={{ ...profile, role: "viewer" }}
    />,
  );

  assert.doesNotMatch(html, /Save profile/);
  assert.match(html, /profile is view-only in this workspace/i);
});
