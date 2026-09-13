import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { readFileSync } from "node:fs";
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

test("Escape dismisses help and pointer exit preserves keyboard focus", () => {
  assert.equal(getPortalRoleHelpExpandedRole("owner", "escape"), null);
  assert.equal(
    getPortalRoleHelpExpandedRole("owner", "mouse_leave", true),
    "owner",
  );
  assert.equal(
    getPortalRoleHelpExpandedRole("owner", "mouse_leave", false),
    null,
  );
});

test("Escape dismissal persists when the pointer leaves a focused help button", () => {
  const dismissed = getPortalRoleHelpExpandedRole("owner", "escape");
  assert.equal(
    getPortalRoleHelpExpandedRole("owner", "mouse_leave", true, dismissed),
    null,
  );
});

test("help button and sibling tooltip share a continuous hover boundary", () => {
  const source = readFileSync(
    new URL("./portal-role-picker.tsx", import.meta.url),
    "utf8",
  );
  const help = source.slice(source.indexOf("className={styles.help}"));
  assert.match(help, /onMouseLeave=/);
  assert.match(source, /event.key === "Escape"/);
  assert.match(
    source,
    /document.addEventListener\("keydown", dismissOnEscape\)/,
  );
  assert.match(
    source,
    /document.removeEventListener\("keydown", dismissOnEscape\)/,
  );
  const button = help.slice(help.indexOf("<button"), help.indexOf("</button>"));
  assert.doesNotMatch(button, /onMouseLeave=/);
  assert.match(help, /role="tooltip"/);
  const css = readFileSync(
    new URL("./portal-role-picker.module.css", import.meta.url),
    "utf8",
  );
  assert.match(css, /\.help\s*\{[^}]*position: relative;/);
  assert.match(css, /\.tooltip\s*\{[^}]*bottom: 100%;/);
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
