import assert from "node:assert/strict";
import test from "node:test";
import {
  businessParts,
  estimateLabelWidth,
  fitLabelX,
  heroLabels,
  labelPosition,
  labelPull,
  networkStage,
  storyLabels,
} from "./value-network-labels";

test("six business parts plus the FSS hub, in both layouts", () => {
  const names = [...businessParts, "FSS"];
  assert.deepEqual(
    heroLabels.map((item) => item.name),
    names,
  );
  assert.deepEqual(
    storyLabels.map((item) => item.name),
    names,
  );
  [...heroLabels, ...storyLabels].forEach((item) => {
    [item.x, item.y, item.sx, item.sy].forEach((value) =>
      assert.ok(value >= 0.05 && value <= 0.95),
    );
  });
});

test("hero labels stay on the right, clear of the headline column", () => {
  heroLabels.forEach((item) => {
    assert.ok(item.x >= 0.55 && item.x <= 0.8);
    assert.ok(item.y >= 0.1 && item.y <= 0.8);
  });
});

test("story state: scattered, then joined, then one path, never backwards", () => {
  assert.deepEqual(networkStage(0), { settle: 0, join: 0, path: 0 });
  const middle = networkStage(0.5);
  assert.equal(middle.join, 1);
  assert.equal(middle.path, 0);
  assert.ok(middle.settle > 0 && middle.settle < 1);
  assert.deepEqual(networkStage(1), { settle: 1, join: 1, path: 1 });
  let last = networkStage(0);
  for (let progress = 0; progress <= 1; progress += 0.05) {
    const stage = networkStage(progress);
    assert.ok(stage.settle >= last.settle && stage.join >= last.join);
    assert.ok(stage.path >= last.path);
    last = stage;
  }
});

test("label positions run from scattered to the path", () => {
  const item = storyLabels[0];
  assert.deepEqual(labelPosition(item, 0), { x: item.sx, y: item.sy });
  const end = labelPosition(item, 1);
  assert.ok(Math.abs(end.x - item.x) < 1e-9 && Math.abs(end.y - item.y) < 1e-9);
});

test("pointer pull is bounded, toward the pointer and zero out of range", () => {
  const anchor = { x: 100, y: 100 };
  const near = labelPull(anchor, { x: 150, y: 100 });
  assert.ok(near.x > 0 && near.x <= 9 && near.y === 0 && near.glow > 0);
  assert.deepEqual(labelPull(anchor, null), { x: 0, y: 0, glow: 0 });
  assert.deepEqual(labelPull(anchor, { x: 900, y: 900 }), {
    x: 0,
    y: 0,
    glow: 0,
  });
  assert.deepEqual(labelPull(anchor, anchor), { x: 0, y: 0, glow: 0 });
});

test("labels slide inward so the whole box stays inside the stage", () => {
  const width = estimateLabelWidth("Invoices", 12);
  const inside = (x: number, stage: number) =>
    x - width / 2 >= 0 && x + width / 2 <= stage;
  // Wide stage: a label already inside is left alone.
  assert.equal(fitLabelX(300, width, 835), 300);
  // Mid stage: a node near the right edge pulls its label back in.
  const mid = fitLabelX(590, width, 594);
  assert.ok(mid < 590 && inside(mid, 594));
  // Left edge is guarded too.
  assert.ok(inside(fitLabelX(2, width, 594), 594));
  // Narrow stage: too small for the label, so it is centred.
  assert.equal(fitLabelX(90, width, 60), 30);
});
