import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { portalRoleOptions } from "@/lib/operations/auth/access-dashboard-metrics";

const require = createRequire(import.meta.url);

require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};

const { PortalRolePicker } =
  require("./portal-role-picker") as typeof import("./portal-role-picker");

test("role picker exposes native radios, help buttons and persistent selection description", () => {
  const html = renderToStaticMarkup(
    <PortalRolePicker
      name="role"
      defaultValue="viewer"
      disabled={false}
      options={portalRoleOptions}
    />,
  );

  assert.match(html, /type="radio"/);
  assert.match(html, /name="role"/);
  assert.match(html, /aria-describedby="portal-role-description"/);
  assert.match(html, /aria-label="More about Owner"/);
  assert.match(html, /Read-only projects, documents, and services/);
});
