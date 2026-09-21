import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { resolvePortalClaimDestination } from "./portal-claim-destination";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const { InvitationExpired } =
  require("./invitation-expired") as typeof import("./invitation-expired");

test("accepted accounts continue to organisation onboarding when no tenant exists", () => {
  assert.equal(
    resolvePortalClaimDestination({
      active: false,
      onboardingRequired: true,
    }),
    "/onboarding",
  );
  assert.equal(resolvePortalClaimDestination({ active: true }), "/");
  assert.equal(
    resolvePortalClaimDestination({ active: true, destination: "admin" }),
    "/admin",
  );
  assert.throws(() => resolvePortalClaimDestination({ active: false }));
});

test("expired invitations direct existing users to sign in without workspace details", () => {
  const html = renderToStaticMarkup(
    createElement(InvitationExpired, { loginHref: "/portal/login" }),
  );

  assert.match(html, /This invitation has expired/);
  assert.match(html, /A fresh invitation is needed/);
  assert.match(html, /Request a new invitation/);
  assert.match(html, /Sign in with your existing account/);
  assert.doesNotMatch(html, /Northstar|organisation/i);
});
