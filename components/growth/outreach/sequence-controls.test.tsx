import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { OutreachSequenceDetail } from "@/lib/growth/dashboard/outreach";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};

const { SequenceControlsFrame } =
  require("./sequence-controls") as typeof import("./sequence-controls");

function baseDetail(
  overrides: Partial<OutreachSequenceDetail> = {},
): OutreachSequenceDetail {
  return {
    sequenceId: "11111111-1111-4111-8111-111111111111",
    prospectId: "22222222-2222-4222-8222-222222222222",
    status: "active",
    currentStep: 1,
    stopReason: null,
    stoppedAt: null,
    startedAt: "2026-08-15T09:12:00.000Z",
    gmailThreadUrl: "https://mail.google.com/mail/u/0/#all/thread-abc",
    resumable: false,
    businessName: "Smith & Sons Plumbing Ltd",
    websiteUrl: null,
    contactName: "Daniel Smith",
    contactEmail: "daniel@smithandsonsplumbing.co.uk",
    fitScore: 91,
    recommendedOffer: "Website + AI Enquiry Agent",
    estimatedOneOffMinPence: 300_000,
    estimatedOneOffMaxPence: 600_000,
    timeline: [],
    threadHealth: { deliveredCount: 1, repliedCount: 0, lastGmailSyncAt: null },
    ...overrides,
  };
}

function render(detail: OutreachSequenceDetail): string {
  return renderToStaticMarkup(
    <SequenceControlsFrame detail={detail} onSuccess={() => {}} />,
  );
}

test("shows Pause (not Resume) for an active sequence", () => {
  const html = render(baseDetail({ status: "active", resumable: false }));
  assert.match(html, />Pause<\/button>/);
  assert.doesNotMatch(html, />Resume<\/button>/);
});

test("shows Resume instead of Pause once the sequence is paused", () => {
  const html = render(baseDetail({ status: "paused", resumable: true }));
  assert.match(html, />Resume<\/button>/);
  assert.doesNotMatch(html, />Pause<\/button>/);
});

test("renders started-talks, reject, and do-not-contact for an active sequence", () => {
  const html = render(baseDetail());
  assert.match(html, />Started talks<\/button>/);
  assert.match(html, />Reject<\/button>/);
  assert.match(html, />Do not contact<\/button>/);
});

test("disables every control once a sequence has permanently stopped", () => {
  for (const status of [
    "stopped_reply",
    "stopped_opt_out",
    "stopped_bounce",
    "stopped_rejected",
    "stopped_started_talks",
    "completed",
  ]) {
    const html = render(baseDetail({ status, resumable: false }));
    assert.match(html, /<button[^>]*disabled=""[^>]*>\s*Pause<\/button>/);
    assert.match(
      html,
      /<button[^>]*disabled=""[^>]*>\s*Started talks<\/button>/,
    );
    assert.match(html, /<button[^>]*disabled=""[^>]*>\s*Reject<\/button>/);
    assert.match(
      html,
      /<button[^>]*disabled=""[^>]*>\s*Do not contact<\/button>/,
    );
    assert.doesNotMatch(html, />Resume<\/button>/);
  }
});
