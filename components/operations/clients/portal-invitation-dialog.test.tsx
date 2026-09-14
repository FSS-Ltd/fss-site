import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};

const { PortalInvitationDialog } =
  require("./portal-invitation-dialog") as typeof import("./portal-invitation-dialog");

test("renders the portal invitation as a modal task with the required details", () => {
  const markup = renderToStaticMarkup(
    <PortalInvitationDialog onInvitationSent={() => undefined} />,
  );

  assert.match(markup, /Invite portal user/);
  assert.match(markup, /<dialog/);
  assert.doesNotMatch(markup, /Founder/);
  assert.doesNotMatch(markup, /Invitation type/);
  assert.doesNotMatch(markup, /name="organisationId"/);
  assert.match(markup, /name="email"/);
  assert.match(markup, /name="name"/);
  assert.match(markup, /name="role"/);
  assert.match(markup, /Access approval note/);
  assert.match(markup, />Cancel</);
});

test("allows the portal access header to supply its primary action style", () => {
  const markup = renderToStaticMarkup(
    <PortalInvitationDialog
      onInvitationSent={() => undefined}
      triggerClassName="primaryAction"
    />,
  );

  assert.match(markup, /class="primaryAction"/);
  assert.match(markup, /Invite portal user/);
});
