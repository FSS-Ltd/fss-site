import assert from "node:assert/strict";
import test from "node:test";
import {
  buildValueNetwork,
  networkFormation,
  networkPointerOffset,
} from "./value-network";

test("the structure builds from bottom-left to top-right and reverses with scroll", () => {
  assert.equal(networkFormation(0, { x: 0, y: 1 }), 0);
  assert.equal(networkFormation(0.25, { x: 0, y: 1 }), 1);
  assert.equal(networkFormation(0.25, { x: 1, y: 0 }), 0);
  assert.equal(networkFormation(1, { x: 1, y: 0 }), 1);
  assert.equal(networkFormation(-1, { x: 0, y: 1 }), 0);
  assert.equal(networkFormation(2, { x: 1, y: 0 }), 1);
});

test("connections assemble after their endpoint nodes", () => {
  const point = { x: 0.5, y: 0.5 };
  assert.equal(networkFormation(0.5, point, true), 0);
  assert.ok(networkFormation(0.5, point) > 0);
  assert.equal(networkFormation(1, point, true), 1);
});

test("network anchors are deterministic, bounded and all connected", () => {
  const graph = buildValueNetwork(1280, 720, 100);
  assert.deepEqual(graph, buildValueNetwork(1280, 720, 100));
  assert.ok(graph.nodes.length >= 80 && graph.nodes.length <= 120);
  graph.nodes.forEach(({ x, y }) =>
    assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1),
  );
  const reached = new Set([0]);
  for (let pass = 0; pass < graph.nodes.length; pass += 1) {
    graph.edges.forEach(([a, b]) => {
      if (reached.has(a) || reached.has(b)) {
        reached.add(a);
        reached.add(b);
      }
    });
  }
  assert.equal(reached.size, graph.nodes.length);
  assert.ok(buildValueNetwork(390, 844, 20).nodes.length < graph.nodes.length);
});

test("pointer response is bounded to three pixels and never accumulates", () => {
  const anchor = { x: 100, y: 100 };
  for (let x = -100; x < 300; x += 5) {
    const offset = networkPointerOffset(anchor, { x, y: 102 });
    assert.ok(Math.hypot(offset.x, offset.y) <= 3);
  }
  assert.deepEqual(networkPointerOffset(anchor, null), { x: 0, y: 0 });
  assert.deepEqual(networkPointerOffset(anchor, anchor), { x: 0, y: 0 });
  assert.deepEqual(networkPointerOffset(anchor, { x: 500, y: 500 }), {
    x: 0,
    y: 0,
  });
  assert.deepEqual(anchor, { x: 100, y: 100 });
});
