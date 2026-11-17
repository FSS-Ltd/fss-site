import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { useGrowthEvents, type GrowthRefresh } from "./use-growth-events";

const dom = new JSDOM("<!doctype html><body></body>", {
  url: "http://localhost",
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  IS_REACT_ACT_ENVIRONMENT: true,
});
class FakeEventSource extends EventTarget {
  static instance: FakeEventSource;
  closed = false;
  onerror: (() => void) | null = null;
  constructor() {
    super();
    FakeEventSource.instance = this;
  }
  close() {
    this.closed = true;
  }
  emit(name: string) {
    this.dispatchEvent(new Event(name));
  }
}
Object.assign(globalThis, { EventSource: FakeEventSource });

test("refreshes on ready, coalesces hints, and stops on authentication failure", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  let resolveFirst: ((result: "ok") => void) | undefined;
  let calls = 0;
  let signal: AbortSignal | undefined;
  const refresh: GrowthRefresh = async (value) => {
    signal = value;
    calls++;
    if (calls === 1)
      return new Promise((resolve) => {
        resolveFirst = resolve;
      });
    return calls === 2 ? "ok" : "auth-failed";
  };
  function Component() {
    return createElement("span", null, useGrowthEvents(refresh));
  }
  await act(async () => root.render(createElement(Component)));
  const source = FakeEventSource.instance;
  assert.equal(calls, 0);
  await act(async () => {
    source.emit("ready");
    source.emit("change");
    source.emit("change");
  });
  assert.equal(calls, 1);
  await act(async () => {
    resolveFirst?.("ok");
  });
  assert.equal(calls, 2);
  assert.equal(container.textContent, "ready");
  await act(async () => {
    source.emit("change");
  });
  assert.equal(container.textContent, "auth-failed");
  assert.equal(source.closed, true);
  await act(async () => root.unmount());
  assert.equal(signal?.aborted, true);
});
