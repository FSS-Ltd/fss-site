import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { readFileSync } from "node:fs";
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
  assert.match(
    html,
    /class="rowAction" href="\/growth\/operations\/clients\/id\/requests"/,
  );
  assert.doesNotMatch(html, /<main\b/);
  assert.match(html, /1 client organisation on this page/);
  assert.match(html, /2 reviewed engagement links/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<dt>Engagements<\/dt><dd>2<\/dd>/);
  assert.equal(html.match(/data-status="active">active<\/span>/g)?.length, 2);
  assert.match(html, /after=next/);
  assert.match(html, /href="\/growth\/operations\/portal-access"/);
  assert.doesNotMatch(html, /<button|<form|<script>/);
});

test("standalone Requests action has a non-inline 44px target", () => {
  const css = readFileSync(
    new URL("./client-list.module.css", import.meta.url),
    "utf8",
  );
  assert.match(
    css,
    /\.rowAction\s*\{[^}]*display: inline-flex;[^}]*min-height: 44px;/,
  );
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
