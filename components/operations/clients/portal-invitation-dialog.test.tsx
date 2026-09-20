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
const { PortalInvitationFields } =
  require("./portal-invitation-fields") as typeof import("./portal-invitation-fields");

test("renders the portal invitation as a modal task with the required details", () => {
  const markup = renderToStaticMarkup(
    <PortalInvitationDialog
      onInvitationSent={() => undefined}
      organisations={[{ id: "org-1", displayName: "Acme Ltd" }]}
    />,
  );

  assert.match(markup, /Invite portal user/);
  assert.match(markup, /<dialog/);
  assert.match(markup, /New client owner/);
  assert.match(markup, /Existing client user/);
  assert.match(markup, /FSS Admin/);
  assert.doesNotMatch(markup, /name="organisationId"/);
  assert.match(markup, /name="email"/);
  assert.match(markup, /name="name"/);
  assert.doesNotMatch(markup, /name="role"/);
  assert.match(markup, /Access approval note/);
  assert.match(markup, />Cancel</);
});

test("allows the portal access header to supply its primary action style", () => {
  const markup = renderToStaticMarkup(
    <PortalInvitationDialog
      onInvitationSent={() => undefined}
      organisations={[]}
      triggerClassName="primaryAction"
    />,
  );

  assert.match(markup, /class="primaryAction"/);
  assert.match(markup, /Invite portal user/);
});

test("Admin form displays a fixed role without client role or organisation controls", () => {
  const markup = renderToStaticMarkup(
    <PortalInvitationFields type="admin" organisations={[]} pending={false} />,
  );
  assert.match(markup, /readOnly=""[^>]*value="Admin"/);
  assert.doesNotMatch(markup, /name="role"|name="organisationId"/);
  assert.match(markup, /name="name"/);
  assert.match(markup, /name="email"/);
  const pending = renderToStaticMarkup(
    <PortalInvitationFields type="existing_client" organisations={[]} pending />,
  );
  assert.match(pending, /name="role" disabled=""/);
});
