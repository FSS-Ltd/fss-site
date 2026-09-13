import assert from "node:assert/strict";
import test from "node:test";
import { storyChapter, storyInterval } from "./story-progress";

test("story intervals clamp deep links and reverse scrolling", () => {
  assert.equal(storyInterval(-1, 0.2, 0.8), 0);
  assert.equal(storyInterval(2, 0.2, 0.8), 1);
  assert.ok(Math.abs(storyInterval(0.5, 0.2, 0.8) - 0.5) < 0.0001);
});

test("each chapter has a fully visible stationary reading interval", () => {
  [0, 1, 2].forEach((index) => {
    assert.deepEqual(storyChapter(index / 3 + 0.15, index), {
      opacity: 1,
      y: 0,
      mask: 0,
    });
  });
});

test("old chapters exit and the final chapter remains readable", () => {
  assert.equal(storyChapter(0.4, 0).opacity, 0);
  assert.equal(storyChapter(0.7, 1).opacity, 0);
  assert.deepEqual(storyChapter(1, 2), { opacity: 1, y: 0, mask: 0 });
});

test("phrase handoffs never leave a blank scene", () => {
  for (let tick = 0; tick <= 1000; tick += 1) {
    const visible = Array.from(
      { length: 5 },
      (_, index) => storyChapter(tick / 1000, index, 5).opacity,
    );
    assert.ok(Math.max(...visible) > 0.25);
  }
});
