import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { createRequire } from "node:module";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { OutreachVisibility } from "./outreach-visibility";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};
const { CampaignDailyLive } =
  require("./campaign-daily-live") as typeof import("./campaign-daily-live");
const dom = new JSDOM("<!doctype html><body></body>", {
  url: "http://localhost",
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  IS_REACT_ACT_ENVIRONMENT: true,
});
class Source extends EventTarget {
  static instance: Source;
  closed = false;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    super();
    Source.instance = this;
  }
  close() {
    this.closed = true;
  }
  emit(name: string) {
    this.dispatchEvent(new Event(name));
  }
}
Object.assign(globalThis, { EventSource: Source });
test("visible daily subscriber reauthorizes on hints and closes when hidden", async () => {
  let requests = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    requests++;
    return Response.json({ status: "empty" });
  };
  const router = {
    back() {},
    forward() {},
    refresh() {},
    push() {},
    replace() {},
    prefetch() {},
    bfcacheId: "test",
  };
  const root = createRoot(document.createElement("div"));
  const view = (visible: boolean) => (
    <AppRouterContext.Provider value={router}>
      <OutreachVisibility.Provider value={visible}>
        <CampaignDailyLive initial={{ status: "empty" }} />
      </OutreachVisibility.Provider>
    </AppRouterContext.Provider>
  );
  try {
    await act(async () => root.render(view(true)));
    const source = Source.instance;
    assert.equal(source.url, "/api/growth/events?topic=daily-summary");
    await act(async () => {
      source.emit("ready");
    });
    assert.equal(requests, 1);
    await act(async () => {
      source.emit("change");
    });
    assert.equal(requests, 2);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await act(async () =>
      document.dispatchEvent(new dom.window.Event("visibilitychange")),
    );
    assert.equal(source.closed, true);
    source.emit("change");
    assert.equal(requests, 2);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    await act(async () =>
      document.dispatchEvent(new dom.window.Event("visibilitychange")),
    );
    const resumed = Source.instance;
    await act(async () => resumed.emit("ready"));
    assert.equal(requests, 3);
    await act(async () => root.render(view(false)));
    assert.equal(resumed.closed, true);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = original;
  }
});
