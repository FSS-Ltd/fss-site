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
    return createElement("span", null, useGrowthEvents(refresh).state);
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

test("manual and event refreshes coalesce, recover from errors, and stop on manual authentication failure", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  let calls = 0;
  let resolvePending: ((result: "ok") => void) | undefined;
  const refresh: GrowthRefresh = async () => {
    calls++;
    if (calls === 1)
      return new Promise((resolve) => {
        resolvePending = resolve;
      });
    if (calls === 2) return "error";
    if (calls === 3) return "ok";
    return "auth-failed";
  };
  function Component() {
    const { state, invalidate } = useGrowthEvents(refresh);
    return createElement("button", { onClick: invalidate }, state);
  }
  await act(async () => root.render(createElement(Component)));
  const source = FakeEventSource.instance;
  const button = container.querySelector("button");
  assert.ok(button);
  await act(async () => {
    source.emit("ready");
    button.click();
    source.emit("change");
  });
  assert.equal(calls, 1);
  await act(async () => {
    resolvePending?.("ok");
  });
  assert.equal(calls, 2);
  assert.equal(button.textContent, "error");
  await act(async () => {
    button.click();
  });
  assert.equal(button.textContent, "ready");
  await act(async () => {
    button.click();
  });
  assert.equal(button.textContent, "auth-failed");
  assert.equal(source.closed, true);
  await act(async () => {
    button.click();
    source.emit("change");
  });
  assert.equal(calls, 4);
  await act(async () => root.unmount());
});

test("superseded snapshots do not turn a healthy stream into an error", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  let calls = 0;
  const refresh: GrowthRefresh = async () =>
    ++calls === 1 ? "ok" : "superseded";
  function Component() {
    const { state, invalidate } = useGrowthEvents(refresh);
    return createElement("button", { onClick: invalidate }, state);
  }
  await act(async () => root.render(createElement(Component)));
  await act(async () => {
    FakeEventSource.instance.emit("ready");
  });
  const button = container.querySelector("button");
  assert.ok(button);
  assert.equal(button.textContent, "ready");
  await act(async () => {
    button.click();
  });
  assert.equal(button.textContent, "ready");
  await act(async () => root.unmount());
});

test("authentication failure stays terminal when the selected view changes", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  let calls = 0;
  const first: GrowthRefresh = async () => {
    calls++;
    return "auth-failed";
  };
  const second: GrowthRefresh = async () => {
    calls++;
    return "ok";
  };
  function Component({ refresh }: { refresh: GrowthRefresh }) {
    return createElement("span", null, useGrowthEvents(refresh).state);
  }
  await act(async () =>
    root.render(createElement(Component, { refresh: first })),
  );
  const source = FakeEventSource.instance;
  await act(async () => source.emit("ready"));
  assert.equal(container.textContent, "auth-failed");
  await act(async () =>
    root.render(createElement(Component, { refresh: second })),
  );
  assert.equal(FakeEventSource.instance, source);
  assert.equal(source.closed, true);
  assert.equal(calls, 1);
  await act(async () => root.unmount());
});
