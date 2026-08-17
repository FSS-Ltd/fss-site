import assert from "node:assert/strict";
import test from "node:test";

import { createMobileDialogController } from "./mobile-dialog-controller";

class FakeDialog extends EventTarget {
  open = false;
  private closePending = false;

  showModal() {
    this.open = true;
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.closePending = true;
  }

  flushCloseEvent() {
    if (!this.closePending) return;
    this.closePending = false;
    this.dispatchEvent(new Event("close"));
  }
}

class FakeMediaQuery extends EventTarget {
  matches = true;
}

function createHarness(initialOverflow = "clip") {
  const dialog = new FakeDialog();
  const mediaQuery = new FakeMediaQuery();
  const bodyStyle = { overflow: initialOverflow };
  let focusCount = 0;
  const controller = createMobileDialogController({
    bodyStyle,
    dialog,
    mediaQuery,
    trigger: { focus: () => focusCount++ },
  });

  return {
    bodyStyle,
    controller,
    dialog,
    focusCount: () => focusCount,
    mediaQuery,
  };
}

test("opens modally, owns the scroll lock, and restores focus on close", () => {
  const harness = createHarness();

  harness.controller.open();
  assert.equal(harness.dialog.open, true);
  assert.equal(harness.bodyStyle.overflow, "hidden");

  harness.controller.close();
  harness.dialog.flushCloseEvent();
  assert.equal(harness.dialog.open, false);
  assert.equal(harness.bodyStyle.overflow, "clip");
  assert.equal(harness.focusCount(), 1);
});

test("closes and unlocks without focusing a hidden trigger on breakpoint exit", () => {
  const harness = createHarness();
  harness.controller.open();

  harness.mediaQuery.matches = false;
  harness.mediaQuery.dispatchEvent(new Event("change"));
  harness.dialog.flushCloseEvent();

  assert.equal(harness.dialog.open, false);
  assert.equal(harness.bodyStyle.overflow, "clip");
  assert.equal(harness.focusCount(), 0);
});

test("does not overwrite a body lock it never owned", () => {
  const harness = createHarness("hidden");

  harness.controller.dispose();

  assert.equal(harness.bodyStyle.overflow, "hidden");
});

test("route-driven close releases the lock without moving focus", () => {
  const harness = createHarness();
  harness.controller.open();

  harness.controller.close({ restoreFocus: false });
  harness.dialog.flushCloseEvent();

  assert.equal(harness.dialog.open, false);
  assert.equal(harness.bodyStyle.overflow, "clip");
  assert.equal(harness.focusCount(), 0);
});

test("preserves no-focus intent across close signals before event delivery", () => {
  const harness = createHarness();
  harness.controller.open();

  harness.controller.close({ restoreFocus: false });
  harness.controller.close({ restoreFocus: false });
  harness.dialog.flushCloseEvent();

  assert.equal(harness.bodyStyle.overflow, "clip");
  assert.equal(harness.focusCount(), 0);
});
