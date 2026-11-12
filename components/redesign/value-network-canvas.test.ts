import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { bindValueNetwork } from "./value-network-canvas";

function setup() {
  mock.timers.enable({ apis: ["setTimeout"] });
  const rafs: Array<() => void> = [];
  let draws = 0;
  const context = new Proxy(
    {},
    {
      get: (_t, key) => {
        if (key === "clearRect") return () => void draws++;
        if (key === "measureText") return () => ({ width: 40 });
        return () => {};
      },
      set: () => true,
    },
  );
  const canvas = {
    dataset: {},
    width: 0,
    height: 0,
    getContext: () => context,
    closest: () => null,
    setAttribute: () => {},
    getBoundingClientRect: () => ({
      top: 0,
      bottom: 500,
      left: 0,
      width: 800,
      height: 500,
    }),
  };
  const noop = () => {};
  const listeners: Record<string, () => void> = {};
  const g = globalThis as Record<string, unknown>;
  g.window = {
    innerWidth: 1200,
    innerHeight: 800,
    devicePixelRatio: 1,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    requestAnimationFrame: (cb: () => void) => rafs.push(cb),
    cancelAnimationFrame: noop,
    addEventListener: (type: string, cb: () => void) => {
      listeners[type] = cb;
    },
    removeEventListener: noop,
  };
  g.document = {
    hidden: false,
    documentElement: { addEventListener: noop, removeEventListener: noop },
    addEventListener: noop,
    removeEventListener: noop,
  };
  g.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  g.getComputedStyle = () => ({ fontFamily: "sans-serif" });
  const flush = () => rafs.splice(0).forEach((cb) => cb());
  return { canvas, rafs, flush, listeners, draws: () => draws };
}

test("repeated draws keep one pending timer and cleanup stops all work", () => {
  const { canvas, rafs, flush, listeners, draws } = setup();
  const cleanup = bindValueNetwork(
    canvas as unknown as HTMLCanvasElement,
    40,
    true,
    false,
  );
  flush();
  assert.ok(draws() >= 1);
  // Scrolls between ticks draw extra frames; each draw must replace the timer.
  for (let i = 0; i < 3; i++) {
    listeners.scroll();
    flush();
  }
  rafs.length = 0;
  mock.timers.tick(40);
  assert.equal(rafs.length, 1, "one pending timer, one frame per tick");
  flush();
  mock.timers.tick(40);
  assert.equal(rafs.length, 1);
  flush();
  // A draw inside the 40 ms window leaves the previous timer pending.
  listeners.scroll();
  flush();
  cleanup();
  const after = draws();
  rafs.length = 0;
  mock.timers.tick(400);
  assert.equal(rafs.length, 0);
  flush();
  assert.equal(draws(), after);
  mock.timers.reset();
});
