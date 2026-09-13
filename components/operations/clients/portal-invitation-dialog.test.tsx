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
    <PortalInvitationDialog
      organisations={[
        {
          id: "8aa24c0b-3665-4fd4-8694-500675c943c3",
          displayName: "Example Ltd",
        },
      ]}
      onInvitationSent={() => undefined}
    />,
  );

  assert.match(markup, /Invite portal user/);
  assert.match(markup, /<dialog/);
  assert.match(markup, /name="email"/);
  assert.match(markup, /name="name"/);
  assert.match(markup, /name="role"/);
  assert.match(markup, /Access approval note/);
  assert.match(markup, />Cancel</);
});
