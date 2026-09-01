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

const { MessageActionsFrame } =
  require("./message-actions") as typeof import("./message-actions");

function baseMessage(
  overrides: Partial<MessageReviewData> = {},
): MessageReviewData {
  return {
    draftTaskId: "11111111-1111-4111-8111-111111111111",
    version: 1,
    revisionCount: 1,
    prospectId: "22222222-2222-4222-8222-222222222222",
    prospectVersion: 2,
    businessName: "Smith & Sons Plumbing Ltd",
    websiteUrl: null,
    fitScore: 91,
    recommendedOffer: "Website + AI Enquiry Agent",
    estimatedOneOffMinPence: 300_000,
    estimatedOneOffMaxPence: 600_000,
    contactName: "Daniel Smith",
    contactEmail: "daniel@smithandsonsplumbing.co.uk",
    founderEmail: "j.ntagengwa@faithfulsoftware.dev",
    subject: "A simpler way to capture plumbing enquiries after hours",
    previewHtml: "<p>Hi Daniel,</p>",
    previewText: "Hi Daniel,",
    editableParagraphs: ["Hi Daniel,"],
    wordCount: 192,
    imageAltText: "A concept visual for Smith & Sons",
    imageByteSize: 146_000,
    visualKind: "fallback",
    visualReviewStatus: null,
    citations: [],
    createdAt: "2026-08-15T06:18:00.000Z",
    eligibility: { ready: true, reasons: [] },
    followUpCadence: [
      { day: "Day 1", label: "Personalised email" },
      { day: "Day 5", label: "Short follow-up" },
      { day: "Day 11", label: "Founder-approved SEO and AEO audit" },
      { day: "Day 14", label: "Close the loop" },
    ],
    ...overrides,
  };
}

function render(message: MessageReviewData): string {
  return renderToStaticMarkup(
    <MessageActionsFrame message={message} onSuccess={() => {}} />,
  );
}

test("renders every decision action with a labelled button", () => {
  const html = render(baseMessage());

  assert.match(html, />Edit draft<\/button>/);
  assert.match(html, />Mark needs redraft<\/button>/);
  assert.match(html, />Create Gmail draft<\/button>/);
  assert.match(html, />Approve &amp; send<\/button>/);
  assert.match(html, />Reject<\/button>/);
  assert.match(html, />Do not contact<\/button>/);
});

test("shows a ready message when nothing blocks sending", () => {
  const html = render(baseMessage());
  assert.match(html, /Ready for founder review\./);
});

test("disables send and Gmail-draft actions and explains why when not eligible", () => {
  const html = render(
    baseMessage({
      eligibility: {
        ready: false,
        reasons: ["This contact is suppressed and cannot be emailed."],
      },
    }),
  );

  assert.match(html, /Sending is blocked until these are resolved:/);
  assert.match(html, /This contact is suppressed and cannot be emailed\./);
  assert.match(
    html,
    /<button[^>]*disabled=""[^>]*>\s*Create Gmail draft<\/button>/,
  );
  assert.match(
    html,
    /<button[^>]*disabled=""[^>]*>\s*Approve &amp; send<\/button>/,
  );
});

test("keeps edit, redraft, reject, and do-not-contact available even when sending is blocked", () => {
  const html = render(
    baseMessage({ eligibility: { ready: false, reasons: ["blocked"] } }),
  );

  assert.doesNotMatch(
    html,
    /<button[^>]*disabled=""[^>]*>\s*Edit draft<\/button>/,
  );
  assert.doesNotMatch(
    html,
    /<button[^>]*disabled=""[^>]*>\s*Mark needs redraft<\/button>/,
  );
  assert.doesNotMatch(html, /<button[^>]*disabled=""[^>]*>\s*Reject<\/button>/);
  assert.doesNotMatch(
    html,
    /<button[^>]*disabled=""[^>]*>\s*Do not contact<\/button>/,
  );
});

test("does not render the send confirmation dialog until it is opened", () => {
  const html = render(baseMessage());
  assert.doesNotMatch(html, /role="alertdialog"/);
  assert.doesNotMatch(html, /Confirm and send/);
});

test("shows the sequence timing helper text beside the send action", () => {
  const html = render(baseMessage());
  assert.match(
    html,
    /Sending starts the approved Day 1, 5, 11 and 14 sequence\./,
  );
});
