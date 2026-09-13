import assert from "node:assert/strict";
import test from "node:test";

import {
  getMagneticOffset,
  getMotionCapabilities,
  getParticleNodeCount,
  getScrollProgress,
} from "./motion-values";

test("magnetic offsets follow the pointer without leaving the control bounds", () => {
  assert.deepEqual(
    getMagneticOffset({
      pointerX: 240,
      pointerY: 80,
      left: 100,
      top: 40,
      width: 120,
      height: 48,
    }),
    { x: 12, y: 5.12 },
  );
});

test("scroll progress is normalized across before, during, and after a scene", () => {
  assert.equal(getScrollProgress(80, 200), 0);
  assert.equal(getScrollProgress(-50, 200), 0.25);
  assert.equal(getScrollProgress(-260, 200), 1);
  assert.equal(getScrollProgress(-20, 0), 0);
});

test("reduced motion keeps particles visible but stationary", () => {
  assert.deepEqual(
    getMotionCapabilities({ reducedMotion: true, finePointer: true }),
    {
      animateParticles: false,
      showParticles: true,
      magnetic: false,
      scroll: false,
    },
  );
});

test("full motion keeps pointer and scroll enhancement available", () => {
  assert.deepEqual(
    getMotionCapabilities({ reducedMotion: false, finePointer: true }),
    {
      animateParticles: true,
      showParticles: true,
      magnetic: true,
      scroll: true,
    },
  );
});

test("particle density scales at mobile and tablet breakpoints", () => {
  const desktop = getParticleNodeCount({
    baseCount: 120,
    width: 1440,
    height: 900,
    finePointer: true,
  });
  const tablet = getParticleNodeCount({
    baseCount: 120,
    width: 820,
    height: 1100,
    finePointer: true,
  });
  const mobile = getParticleNodeCount({
    baseCount: 120,
    width: 390,
    height: 844,
    finePointer: false,
  });

  assert.ok(desktop > tablet);
  assert.ok(tablet > mobile);
  assert.ok(mobile >= 10);
});
