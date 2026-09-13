import assert from "node:assert/strict";
import test from "node:test";
import { getAppAtomProgress } from "./app-journey-progress";
import { storyChapter } from "./story-progress";

test("all 3555 app atoms are absent before assembly and complete at the end", () => {
  for (let index = 0; index < 3555; index += 1) {
    assert.equal(getAppAtomProgress(0, index), 0);
    assert.equal(getAppAtomProgress(1, index), 1);
  }
});

test("pieces emerge independently and reverse deterministically", () => {
  const values = Array.from({ length: 3555 }, (_, index) =>
    getAppAtomProgress(0.6, index),
  );
  assert.ok(values.some((value) => value === 0));
  assert.ok(values.some((value) => value === 1));
  assert.ok(new Set(values).size > 12);
  for (let index = 0; index < 3555; index += 1) {
    assert.ok(getAppAtomProgress(0.7, index) >= getAppAtomProgress(0.5, index));
  }
});

test("five value phrases each have a readable hold and previous phrases fade out", () => {
  for (let index = 0; index < 5; index += 1) {
    assert.deepEqual(storyChapter((index + 0.5) / 5, index, 5), {
      opacity: 1,
      y: 0,
      mask: 0,
    });
    if (index < 4)
      assert.equal(storyChapter((index + 1.2) / 5, index, 5).opacity, 0);
  }
});
