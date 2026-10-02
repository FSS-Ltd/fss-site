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

const clerkModulePath = require.resolve("@clerk/nextjs");
const clerkMock = new Module(clerkModulePath);

clerkMock.filename = clerkModulePath;
clerkMock.loaded = true;
clerkMock.exports = {
  SignOutButton: ({ children }: { children: React.ReactNode }) => children,
};
require.cache[clerkModulePath] = clerkMock;

const { ClientShell } =
  require("./client-shell") as typeof import("./client-shell");
const { StudioShell } =
  require("./studio-shell") as typeof import("./studio-shell");

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

function renderStudio(prefixFreeEnabled = true): string {
  return renderToStaticMarkup(
    <StudioShell prefixFreeEnabled={prefixFreeEnabled}>
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

test("uses Clerk sign-out controls instead of origin-gated forms", () => {
  assert.doesNotMatch(renderClient("owner"), /api\/auth\/sign-out/);
  assert.doesNotMatch(renderStudio(), /api\/auth\/sign-out/);
});

test("keeps Studio toolbar links in the server-selected portal routing mode", () => {
  assert.match(renderStudio(true), /href="\/admin\/notifications"/);
  assert.match(renderStudio(false), /href="\/portal\/admin\/notifications"/);
});

test("Studio shell uses applied identity, timezone, and delivery capacity", () => {
  const html = renderToStaticMarkup(
    <StudioShell
      studioSettings={{
        displayName: "Applied FSS identity",
        timezone: "America/New_York",
        deliveryCapacity: "limited",
      }}
    >
      <p>Workspace</p>
    </StudioShell>,
  );
  assert.match(html, /Applied FSS identity/);
  assert.match(html, /America\/New_York/);
  assert.match(html, /Limited capacity/);
});
