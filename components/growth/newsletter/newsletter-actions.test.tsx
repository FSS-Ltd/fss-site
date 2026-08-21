import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { NewsletterIssueReview } from "@/lib/growth/dashboard/newsletter";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};

const { NewsletterActionsFrame } =
  require("./newsletter-actions") as typeof import("./newsletter-actions");

function baseIssue(
  overrides: Partial<NewsletterIssueReview> = {},
): NewsletterIssueReview {
  return {
    issueId: "11111111-1111-4111-8111-111111111111",
    issueKey: "august-field-note",
    version: 3,
    status: "ready_for_review",
    subject: "The local service website is becoming an operating system",
    previewText: "Three practical ways to turn enquiries into better work.",
    htmlSnapshot: "<p>Hello {{unsubscribe_url}}</p>",
    textSnapshot: "Hello {{unsubscribe_url}}",
    checksum: "a".repeat(64),
    fromEmail: "hello@faithfulsoftware.dev",
    replyToEmail: "j.ntagengwa@faithfulsoftware.dev",
    audience: { eligibleCount: 842, suppressedCount: 15, pendingCount: 5 },
    asset: null,
    testSentAt: "2026-08-15T09:00:00.000Z",
    testSentVersion: 3,
    isTestCurrent: true,
    approvedAt: null,
    approvedBy: null,
    approvedChecksum: null,
    isApprovalCurrent: false,
    isLocked: false,
    scheduledFor: null,
    sentAt: null,
    createdBy: "founder",
    createdAt: "2026-08-10T09:00:00.000Z",
    updatedAt: "2026-08-15T14:32:00.000Z",
    ...overrides,
  };
}

function render(issue: NewsletterIssueReview): string {
  return renderToStaticMarkup(
    <NewsletterActionsFrame issue={issue} onSuccess={() => {}} />,
  );
}

test("shows both actions enabled for a ready-for-review issue with a current test", () => {
  const html = render(baseIssue());
  assert.match(html, /<button[^>]*>\s*Send test\s*<\/button>/);
  assert.doesNotMatch(
    html,
    /<button[^>]*disabled=""[^>]*>\s*Send test\s*<\/button>/,
  );
  assert.doesNotMatch(
    html,
    /<button[^>]*disabled=""[^>]*>\s*Approve &amp; schedule\s*<\/button>/,
  );
  assert.match(html, /Ready to approve and schedule/);
});

test("prompts for a founder test before scheduling once the snapshot has changed", () => {
  const html = render(baseIssue({ isTestCurrent: false, testSentVersion: 2 }));
  assert.match(html, /Send a founder test of this version before scheduling\./);
});

test("disables Send test once the issue has permanently finished sending", () => {
  for (const status of ["sent", "failed", "cancelled"] as const) {
    const html = render(baseIssue({ status, isLocked: status === "sent" }));
    assert.match(
      html,
      /<button[^>]*disabled=""[^>]*>\s*Send test\s*<\/button>/,
    );
  }
});

test("disables Approve & schedule for a draft issue that has not yet gone to review", () => {
  const html = render(baseIssue({ status: "draft", isTestCurrent: false }));
  assert.match(
    html,
    /<button[^>]*disabled=""[^>]*>\s*Approve &amp; schedule\s*<\/button>/,
  );
});

test("shows the locked/immutable notice once the issue is approved", () => {
  const html = render(
    baseIssue({
      status: "approved",
      approvedAt: "2026-08-16T10:00:00.000Z",
      approvedBy: "founder",
      approvedChecksum: "a".repeat(64),
      isApprovalCurrent: true,
      isLocked: true,
    }),
  );
  assert.match(html, /This issue is approved and its content is locked\./);
});

test("disables Approve & schedule once the issue has already been scheduled", () => {
  const html = render(
    baseIssue({ status: "scheduled", isLocked: true, isTestCurrent: true }),
  );
  assert.match(
    html,
    /<button[^>]*disabled=""[^>]*>\s*Approve &amp; schedule\s*<\/button>/,
  );
});
