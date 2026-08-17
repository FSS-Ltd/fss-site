import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { IntegrationHealth } from "@/lib/growth/dashboard/view-models";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};

const { GrowthShellFrame } =
  require("./growth-shell") as typeof import("./growth-shell");
const shellCss = readFileSync(
  new URL("./shell.module.css", import.meta.url),
  "utf8",
);

const integrations: readonly IntegrationHealth[] = [
  {
    provider: "database",
    status: "healthy",
    checkedAt: "2026-08-17T06:00:00.000Z",
    message: "Database available",
  },
  {
    provider: "gmail",
    status: "attention",
    checkedAt: "2026-08-17T06:00:00.000Z",
    message: "Gmail needs attention",
  },
];

function renderShell(pathname = "/growth/prospects"): string {
  return renderToStaticMarkup(
    <GrowthShellFrame
      founder={{
        email: "j.ntagengwa@faithfulsoftware.dev",
      }}
      integrations={integrations}
      pathname={pathname}
    >
      <h1>Prospects</h1>
    </GrowthShellFrame>,
  );
}

test("renders one skip link and a labelled dashboard main region", () => {
  const html = renderShell();

  assert.equal((html.match(/Skip to dashboard content/g) ?? []).length, 1);
  assert.match(html, /href="#growth-main"/);
  assert.match(html, /<main[^>]+id="growth-main"/);
  assert.match(html, />Prospects<\/h1>/);
});

test("exposes labelled navigation and the current page", () => {
  const html = renderShell();

  assert.match(html, /aria-label="Primary dashboard"/);
  assert.match(html, /aria-label="Dashboard shortcuts"/);
  assert.match(
    html,
    /<a(?=[^>]*aria-current="page")(?=[^>]*href="\/growth\/prospects")[^>]*>/,
  );
});

test("keeps the wide navigation collapsed at common laptop widths", () => {
  assert.match(
    shellCss,
    /@media \(max-width: 1535px\)[\s\S]*?\.topNav,[\s\S]*?display: none/,
  );
});

test("renders a keyboard-native mobile navigation dialog", () => {
  const html = renderShell();

  assert.match(html, /aria-label="Mobile dashboard"/);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /<dialog[^>]+aria-labelledby="growth-mobile-menu-title"/);
  assert.match(html, /aria-label="Close navigation"/);
});

test("marks More as current when the active mobile route is in the dialog", () => {
  const html = renderShell("/growth/deals/active-deal");

  assert.match(
    html,
    /<button(?=[^>]*aria-current="page")(?=[^>]*aria-haspopup="dialog")[^>]*>/,
  );
});

test("only displays mobile navigation below the phone breakpoint", () => {
  assert.match(
    shellCss,
    /\.mobileNav,[\s\S]*?\.mobileDialog[\s\S]*?display: none/,
  );
  assert.match(
    shellCss,
    /@media \(max-width: 767px\)[\s\S]*?\.mobileNav[\s\S]*?display: grid/,
  );
});

test("shows founder identity and a sign-out action", () => {
  const html = renderShell();

  assert.match(html, /j\.ntagengwa@faithfulsoftware\.dev/);
  assert.match(
    html,
    /<button(?=[^>]*aria-label="Sign out")(?=[^>]*type="submit")[^>]*>/,
  );
  assert.match(html, />Sign out<\/span>/);
  assert.match(html, /<img alt=""/);
});

test("summarises integration health without rendering secret fields", () => {
  const html = renderShell();

  assert.match(html, /aria-label="Integration status: attention"/);
  assert.match(html, />Database<\/span>/);
  assert.match(html, />Gmail<\/span>/);
  assert.match(html, /Gmail needs attention/);
  assert.doesNotMatch(
    html,
    /encrypted_refresh_token|provider_cursor|last_error_code/i,
  );
});

test("does not degrade overall health for intentionally disabled integrations", () => {
  const html = renderToStaticMarkup(
    <GrowthShellFrame
      founder={{ email: "founder@example.test" }}
      integrations={[
        {
          provider: "database",
          status: "healthy",
          checkedAt: "2026-08-17T06:00:00.000Z",
          message: "Database available",
        },
        {
          provider: "codex",
          status: "disabled",
          checkedAt: "2026-08-17T06:00:00.000Z",
          message: "Codex not configured",
        },
      ]}
      pathname="/growth"
    >
      <h1>Overview</h1>
    </GrowthShellFrame>,
  );

  assert.match(html, /aria-label="Integration status: healthy"/);
});
