import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);

require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const { PortalNavigationIcon } =
  require("./navigation-icon") as typeof import("./navigation-icon");

test("renders a decorative Lucide icon for a named Studio destination", () => {
  const html = renderToStaticMarkup(
    <PortalNavigationIcon itemId="requests" />,
  );

  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /<svg/);
  assert.match(html, /data-navigation-icon="requests"/);
});

test("keeps an icon available for future navigation IDs", () => {
  const html = renderToStaticMarkup(
    <PortalNavigationIcon itemId="future-destination" />,
  );

  assert.match(html, /<svg/);
  assert.match(html, /data-navigation-icon="future-destination"/);
});
