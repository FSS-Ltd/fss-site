import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { TimelineEvent } from "@/lib/growth/dashboard/outreach";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};

const { SequenceTimeline } =
  require("./sequence-timeline") as typeof import("./sequence-timeline");

test("renders the close-the-loop email as Day 14", () => {
  const timeline: TimelineEvent[] = [
    {
      id: "close-loop",
      kind: "scheduled",
      stepNumber: 3,
      label: "Close the loop",
      occurredAt: "2026-09-10T09:00:00.000Z",
      providerObservedAt: null,
      localReceivedAt: null,
      detail: "Scheduled",
    },
  ];

  const html = renderToStaticMarkup(<SequenceTimeline timeline={timeline} />);
  assert.match(html, /Day 14/);
  assert.doesNotMatch(html, /Day 20/);
});
