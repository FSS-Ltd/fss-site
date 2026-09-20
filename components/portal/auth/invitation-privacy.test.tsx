import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
let signedIn = true;
let loaded = true;
let query = "";
const savedAccountEmail = "previous-user@example.test";

// Render the real screen with a saved Clerk session, without making provider calls.
function replaceModule(name: string, exports: object): void {
  const path = require.resolve(name);
  const replacement = new Module(path);
  replacement.exports = exports;
  replacement.loaded = true;
  require.cache[path] = replacement;
}
replaceModule("@clerk/nextjs", {
  useUser: () => ({
    isLoaded: loaded,
    isSignedIn: signedIn,
    user: signedIn
      ? { primaryEmailAddress: { emailAddress: savedAccountEmail } }
      : null,
  }),
  useSignUp: () => ({ signUp: {}, fetchStatus: "idle" }),
  useClerk: () => ({ signOut: async () => undefined }),
});
replaceModule("next/navigation", {
  useRouter: () => ({ replace: () => undefined }),
  useSearchParams: () => new URLSearchParams(query),
});
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};
const { PortalInvitationActivation } =
  require("./invitation-activation") as typeof import("./invitation-activation");

for (const realm of ["staff", "client"]) {
  test(`${realm} invitation never discloses an unrelated saved account or offers acceptance as that account`, () => {
    loaded = true;
    signedIn = true;
    query = `__clerk_ticket=${realm}-ticket&email=invited%40example.test`;
    const html = renderToStaticMarkup(<PortalInvitationActivation />);
    assert.doesNotMatch(
      html,
      /previous-user@example\.test|invited@example\.test/,
    );
    assert.doesNotMatch(html, /Accept invitation and continue/);
    assert.doesNotMatch(html, /href="\/login"/);
    assert.match(html, /Sign out and continue with invitation/);
  });
}

test("a refreshed invitation without an email hint cannot reuse the saved account", () => {
  loaded = true;
  signedIn = true;
  query = "__clerk_ticket=fixture-ticket";
  const html = renderToStaticMarkup(<PortalInvitationActivation />);
  assert.doesNotMatch(
    html,
    /previous-user@example\.test|Accept invitation and continue/,
  );
  assert.match(html, /Sign out and continue with invitation/);
});

test("a matching saved session can accept without disclosing its email", () => {
  loaded = true;
  signedIn = true;
  query = "__clerk_ticket=fixture-ticket&email=previous-user%40example.test";
  const html = renderToStaticMarkup(<PortalInvitationActivation />);
  assert.doesNotMatch(html, /previous-user@example\.test/);
  assert.match(html, /Accept invitation and continue/);
});

test("the invitation action stays disabled while Clerk loads", () => {
  loaded = false;
  signedIn = false;
  query = "__clerk_ticket=fixture-ticket&email=invited%40example.test";
  const html = renderToStaticMarkup(<PortalInvitationActivation />);
  assert.doesNotMatch(
    html,
    /invited@example\.test|previous-user@example\.test/,
  );
  assert.match(html, /type="submit"[^>]*disabled/);
});

test("signed-out invitations do not render recipient email addresses", () => {
  loaded = true;
  signedIn = false;
  query = "__clerk_ticket=fixture-ticket&email=invited%40example.test";
  const html = renderToStaticMarkup(<PortalInvitationActivation />);
  assert.doesNotMatch(
    html,
    /invited@example\.test|previous-user@example\.test/,
  );
  assert.match(html, /Create account and continue/);
});
