import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { MessageReviewData } from "@/lib/growth/dashboard/message-review";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};
const { MessageReview } =
  require("./message-review") as typeof import("./message-review");

const researchMessage: MessageReviewData = {
  draftTaskId: "11111111-1111-4111-8111-111111111111",
  prospectId: "22222222-2222-4222-8222-222222222222",
  version: 1,
  revisionCount: 0,
  prospectVersion: 1,
  businessName: "Local Services",
  websiteUrl: null,
  fitScore: 85,
  recommendedOffer: "Booking portal",
  estimatedOneOffMinPence: 0,
  estimatedOneOffMaxPence: 0,
  contactName: "Business contact",
  contactEmail: "business@example.test",
  founderEmail: "founder@example.test",
  subject: "booking requests",
  previewHtml: "<p>A booking idea.</p>",
  previewText: "A booking idea.",
  editableParagraphs: [],
  wordCount: 3,
  imageAltText: "",
  imageByteSize: null,
  visualKind: "none",
  visualReviewStatus: null,
  researchOnly: true,
  citations: [
    {
      id: "evidence-1",
      sourceType: "first_party",
      sourceUrl: "https://example.test/contact",
      claimSummary: "Appointment requests are handled by phone.",
      verifiedAt: "2026-10-26T08:00:00Z",
    },
  ],
  createdAt: "2026-10-26T08:00:00Z",
  eligibility: {
    ready: false,
    reasons: [
      "Research only. Outreach has not been approved for this contact.",
    ],
  },
  followUpCadence: [],
};

test("research review shows evidence and exact preview without outreach controls or generated visuals", () => {
  const html = renderToStaticMarkup(
    <MessageReview result={{ status: "ready", data: researchMessage }} />,
  );
  assert.match(html, /booking requests/);
  assert.match(html, /A booking idea/);
  assert.match(html, /Appointment requests are handled by phone/);
  assert.match(html, /Business contact/);
  assert.match(html, /Research only/);
  assert.match(html, /Not estimated/);
  assert.doesNotMatch(
    html,
    /Create Gmail draft|Approve &amp; send|Edit draft|Sequence preview|Visual checks|Fallback visual/,
  );
});
