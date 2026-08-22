import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};

const { ClientThankYouReviewFrame } =
  require("./client-thank-you-review") as typeof import("./client-thank-you-review");

const MESSAGE_ID = "11111111-1111-4111-8111-111111111111";

function baseReview(
  overrides: Partial<Parameters<typeof ClientThankYouReviewFrame>[0]["review"]> = {},
) {
  return {
    messageId: MESSAGE_ID,
    engagementId: "22222222-2222-4222-8222-222222222222",
    businessId: "33333333-3333-4333-8333-333333333333",
    businessName: "Smith & Sons Plumbing Ltd",
    engagementName: "Website + AI Enquiry Agent",
    version: 1,
    status: "pending_approval" as const,
    includedNewsletterInvite: true,
    subject: "Thank you for trusting FSS with Website + AI Enquiry Agent",
    previewHtml: "<html><body>Hi Jamie</body></html>",
    previewText: "Hi Jamie",
    recipientName: "Jamie Smith",
    recipientEmail: "jamie@smithplumbing.example",
    testSentAt: null,
    founderEmail: "founder@faithfulsoftware.dev",
    ...overrides,
  };
}

function renderReview(overrides: Parameters<typeof baseReview>[0] = {}): string {
  return renderToStaticMarkup(
    <ClientThankYouReviewFrame onSuccess={() => {}} review={baseReview(overrides)} />,
  );
}

test("renders the envelope, subject, and both action buttons for a pending message", () => {
  const html = renderReview();
  assert.match(html, /jamie@smithplumbing\.example/);
  assert.match(html, /Thank you for trusting FSS/);
  assert.match(html, />Send test to founder@faithfulsoftware\.dev<\/button>/);
  assert.match(html, />Approve and send<\/button>/);
});

test("renders the HTML preview in a sandboxed iframe with no scripting", () => {
  const html = renderReview();
  assert.match(html, /<iframe sandbox=""/);
  assert.match(html, /srcDoc="[^"]*Hi Jamie[^"]*"/);
});

test("offers the newsletter-invite toggle only when the snapshot included it", () => {
  const withInvite = renderReview({ includedNewsletterInvite: true });
  assert.match(withInvite, /Include the FSS Field Notes invitation/);

  const withoutInvite = renderReview({ includedNewsletterInvite: false });
  assert.doesNotMatch(withoutInvite, /Include the FSS Field Notes invitation/);
  assert.match(withoutInvite, /already subscribed/);
});

test("hides the action buttons once the message has already been sent", () => {
  const html = renderReview({ status: "sent" });
  assert.doesNotMatch(html, />Approve and send<\/button>/);
  assert.doesNotMatch(html, />Send test to/);
  assert.match(html, /already been sent/);
});
