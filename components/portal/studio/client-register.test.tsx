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

const { StudioClientRegister } =
  require("./client-register") as typeof import("./client-register");

test("renders the searchable Studio client register with persisted next actions", () => {
  const html = renderToStaticMarkup(
    <StudioClientRegister
      clients={{
        hasNext: true,
        items: [
          {
            activeWorkCount: 2,
            displayName: "Northstar Studio",
            id: "44444444-4444-4444-8444-444444444444",
            legalName: "Northstar Studio Ltd",
            lifecycle: "active",
            nextAction: "Review client work",
            nextActionHref:
              "/portal/admin/clients/44444444-4444-4444-8444-444444444444/requests",
            primaryContactName: "Alex Morgan",
          },
        ],
        page: 1,
      }}
      query="northstar"
    />,
  );

  assert.match(html, /Your clients/);
  assert.match(html, /Add client/);
  assert.match(html, /Northstar Studio/);
  assert.match(html, /Alex Morgan/);
  assert.match(html, /2 active items/);
  assert.match(html, /Review client work/);
  assert.match(html, /query=northstar/);
});
