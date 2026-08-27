import assert from "node:assert/strict";
import test from "node:test";

import {
  PREVIEW_EVENT_NAME,
  trackPreviewEvent,
  type PreviewEvent,
} from "./analytics";

const event: PreviewEvent = {
  prospectSlug: "ashford-auto-centre",
  event: "mot_form_started",
};

function isPreviewEventName(value: string): value is PreviewEvent["event"] {
  return (
    value === "preview_viewed" ||
    value === "owner_cta_clicked" ||
    value === "mot_form_started" ||
    value === "mot_form_completed" ||
    value === "quote_form_started" ||
    value === "quote_form_completed"
  );
}

test("safely does nothing when preview tracking runs during server rendering", () => {
  assert.doesNotThrow(() => trackPreviewEvent(event));
});

test("dispatches a browser event for a later Growth OS integration", () => {
  const originalWindow = Reflect.get(globalThis, "window");
  const browser = new EventTarget();
  const capturedEvents: PreviewEvent[] = [];

  browser.addEventListener(PREVIEW_EVENT_NAME, (browserEvent) => {
    const detail = Reflect.get(browserEvent, "detail");
    if (
      detail &&
      typeof detail === "object" &&
      "prospectSlug" in detail &&
      typeof detail.prospectSlug === "string" &&
      "event" in detail &&
      typeof detail.event === "string" &&
      isPreviewEventName(detail.event)
    ) {
      capturedEvents.push({
        prospectSlug: detail.prospectSlug,
        event: detail.event,
      });
    }
  });
  Reflect.set(globalThis, "window", browser);

  try {
    trackPreviewEvent(event);
    assert.deepEqual(capturedEvents, [event]);
  } finally {
    Reflect.set(globalThis, "window", originalWindow);
  }
});
