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
const { ClientList } =
  require("./client-list") as typeof import("./client-list");

test("client register renders labelled facts, escaped names and pagination without mutation controls", () => {
  const html = renderToStaticMarkup(
    <ClientList
      state={{
        status: "ready",
        data: {
          rows: [
            {
              id: "id",
              displayName: "<script>test</script>",
              legalName: "Example Limited",
              engagementCount: 2,
              tradingStatus: "active",
              lifecycle: "active",
              timezone: "Europe/London",
            },
          ],
          nextCursor: "next",
        },
      }}
    />,
  );
  assert.match(html, /Client register/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<dt>Engagements<\/dt><dd>2<\/dd>/);
  assert.match(html, /after=next/);
  assert.doesNotMatch(html, /<button|<form|<script>/);
});

test("client register empty and failure states keep recovery visible", () => {
  assert.match(
    renderToStaticMarkup(
      <ClientList
        state={{ status: "ready", data: { rows: [], nextCursor: null } }}
      />,
    ),
    /No organisations/,
  );
  const html = renderToStaticMarkup(
    <ClientList state={{ status: "error", message: "Could not load." }} />,
  );
  assert.match(html, /role="alert"/);
  assert.match(html, /Reload client register/);
});
