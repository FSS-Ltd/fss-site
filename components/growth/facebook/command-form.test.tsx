import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = { __esModule: true, default: {} };
};
const { CommandForm } =
  require("./command-form") as typeof import("./command-form");

const dom = new JSDOM("<!doctype html><body></body>", {
  url: "http://localhost",
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  FormData: dom.window.FormData,
  IS_REACT_ACT_ENVIRONMENT: true,
});

test("retries identical commands with the same request id and changes it after edits", async () => {
  const requests: Array<{ requestId: string; name: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    requests.push(JSON.parse(String(init?.body)));
    return new Response("{}", { status: 503 });
  };
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        createElement(
          CommandForm,
          {
            label: "Save",
            build: (data) => ({ type: "test", name: data.get("name") }),
            onSuccess: () => {},
          },
          createElement("input", { name: "name", defaultValue: "first" }),
        ),
      ),
    );
    const form = container.querySelector("form");
    assert.ok(form);
    const submit = async () =>
      act(async () => {
        form.dispatchEvent(
          new dom.window.Event("submit", { bubbles: true, cancelable: true }),
        );
      });
    await submit();
    await submit();
    const input = container.querySelector("input");
    assert.ok(input);
    input.value = "second";
    await submit();
    assert.equal(requests[0].requestId, requests[1].requestId);
    assert.notEqual(requests[1].requestId, requests[2].requestId);
    assert.equal(input.value, "second");
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
  }
});
