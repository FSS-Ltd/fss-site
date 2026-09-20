import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);

require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const navigationModulePath = require.resolve("next/navigation");
const navigationMock = new Module(navigationModulePath);

navigationMock.filename = navigationModulePath;
navigationMock.loaded = true;
navigationMock.exports = {
  usePathname: () => "/portal/requests",
  useSearchParams: () => new URLSearchParams(),
};
require.cache[navigationModulePath] = navigationMock;

const { ClientShell } = require("./client-shell") as typeof import("./client-shell");
const { StudioShell } = require("./studio-shell") as typeof import("./studio-shell");

const membership = {
  displayName: "Northstar Studio",
  organisationId: "0a2f12d2-401d-4a3b-8916-f0a218a87a62",
};

function renderClient(
  role: "owner" | "contributor" | "billing_contact" | "viewer",
): string {
  return renderToStaticMarkup(
    <ClientShell memberships={[{ ...membership, role }]}>
      <p>Client content</p>
    </ClientShell>,
  );
}

function renderStudio(): string {
  return renderToStaticMarkup(
    <StudioShell>
      <p>Studio content</p>
    </StudioShell>,
  );
}

test("keeps client capabilities and Studio navigation isolated", () => {
  assert.doesNotMatch(renderClient("billing_contact"), /Requests/);
  assert.match(renderClient("owner"), /Requests/);
  assert.match(renderClient("contributor"), /Requests/);
  assert.doesNotMatch(renderClient("viewer"), /Requests/);
  assert.doesNotMatch(renderStudio(), /Choose your workspace/);
});

test("marks the active client destination as the current page", () => {
  assert.match(
    renderClient("owner"),
    /aria-current="page"[^>]*href="\/requests\?organisationId=/,
  );
});
