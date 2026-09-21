import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
};
const { PortalAccessWorkspace } = require("./portal-access-workspace") as typeof import("./portal-access-workspace");

test("renders client access controls without leaking provider activation URLs", () => {
  const html = renderToStaticMarkup(
    <PortalAccessWorkspace
      data={{
        contacts: [{ email: "a***@northstar.example", id: "44444444-4444-4444-8444-444444444444", name: "Alex Morgan", organisationId: "55555555-5555-4555-8555-555555555555", organisationName: "Northstar" }],
        hasNext: false,
        items: [{ contactId: "44444444-4444-4444-8444-444444444444", email: "alex@northstar.example", expiresAt: null, id: "membership:66666666-6666-4666-8666-666666666666", invitedAt: "2026-09-20T10:00:00.000Z", lastVerifiedAt: "2026-09-20T10:00:00.000Z", membershipId: "66666666-6666-4666-8666-666666666666", name: "Alex Morgan", organisationId: "55555555-5555-4555-8555-555555555555", organisationName: "Northstar", role: "owner", state: "active" }],
        page: 1,
        query: "",
        state: null,
      }}
    />,
  );
  assert.match(html, /People and portal access/);
  assert.match(html, /Before sending/);
  assert.match(html, /Remove access/);
  assert.doesNotMatch(html, /activationUrl/);
});
