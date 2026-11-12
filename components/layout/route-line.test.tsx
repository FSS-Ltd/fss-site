import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { playRouteLine, RouteLine, routeLineNodes } from "./route-line";

test("renders a hidden line with five rust nodes and no keyframes", () => {
  const html = renderToStaticMarkup(<RouteLine />);

  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /view-transition-name:fss-line/);
  assert.match(html, /opacity:0/);
  assert.equal(html.match(/border-radius:50%/g)?.length, routeLineNodes.length);
  assert.equal(routeLineNodes.length, 5);
});

function fakeLine() {
  const calls: { target: string; options: KeyframeAnimationOptions }[] = [];
  const make = (target: string) =>
    ({
      animate: (_: unknown, options: KeyframeAnimationOptions) =>
        calls.push({ target, options }),
    }) as unknown as HTMLElement;
  const line = make("line");
  const root = Object.assign(make("root"), {
    firstElementChild: line,
    children: [line, ...routeLineNodes.map((_, i) => make(`node${i}`))],
  });
  return { root, calls };
}

test("plays line, nodes in sequence and a fade inside 600 ms", () => {
  const original = globalThis.matchMedia;
  globalThis.matchMedia = (() => ({
    matches: false,
  })) as unknown as typeof matchMedia;
  try {
    const { root, calls } = fakeLine();
    playRouteLine(root);

    assert.equal(calls.length, 2 + routeLineNodes.length);
    const nodes = calls.filter((call) => call.target.startsWith("node"));
    const delays = nodes.map((call) => Number(call.options.delay));
    assert.deepEqual(
      delays,
      [...delays].sort((a, b) => a - b),
    );
    for (const call of calls) {
      const end =
        Number(call.options.delay ?? 0) + Number(call.options.duration);
      assert.ok(end <= 600, `${call.target} ends at ${end} ms`);
    }
  } finally {
    globalThis.matchMedia = original;
  }
});

test("plays nothing under reduced motion", () => {
  const original = globalThis.matchMedia;
  globalThis.matchMedia = (() => ({
    matches: true,
  })) as unknown as typeof matchMedia;
  try {
    const { root, calls } = fakeLine();
    playRouteLine(root);
    assert.equal(calls.length, 0);
  } finally {
    globalThis.matchMedia = original;
  }
});
