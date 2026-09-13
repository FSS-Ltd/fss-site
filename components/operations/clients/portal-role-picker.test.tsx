import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { portalRoleOptions } from "@/lib/operations/auth/access-dashboard-metrics";
import { getPortalRoleHelpExpandedRole } from "./portal-role-picker-state";

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

test("help state keeps a focused role open through activation and closes on exit", () => {
  const focused = getPortalRoleHelpExpandedRole("owner", "focus");

  assert.equal(focused, "owner");
  if (!focused) throw new Error("Focus must open a portal role tooltip.");

  const activated = getPortalRoleHelpExpandedRole(focused, "activate");
  const hovered = getPortalRoleHelpExpandedRole("owner", "hover");

  assert.equal(activated, "owner");
  assert.equal(hovered, "owner");
  assert.equal(getPortalRoleHelpExpandedRole(hovered, "blur"), null);
  assert.equal(getPortalRoleHelpExpandedRole(hovered, "mouse_leave"), null);
});
