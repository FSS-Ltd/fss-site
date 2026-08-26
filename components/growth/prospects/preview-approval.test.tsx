import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { PreviewApprovalFrame } from "./preview-approval";

test("offers a founder approval action for a draft preview", () => {
  const html = renderToStaticMarkup(
    <PreviewApprovalFrame
      onSuccess={() => undefined}
      preview={{ status: "draft", version: 1 }}
      prospectId="11111111-1111-4111-8111-111111111111"
      prospectVersion={3}
      prospectStatus="ready_for_email_review"
    />,
  );

  assert.match(html, />Approve preview<\/button>/);
  assert.match(html, /private concept/);
});

test("does not expose a published preview identifier in the founder UI", () => {
  const html = renderToStaticMarkup(
    <PreviewApprovalFrame
      onSuccess={() => undefined}
      preview={{ status: "published", version: 2 }}
      prospectId="11111111-1111-4111-8111-111111111111"
      prospectVersion={4}
      prospectStatus="ready_for_email_review"
    />,
  );

  assert.match(html, /Preview published/);
  assert.doesNotMatch(html, /Q2VhN4A7x6Y0-5s8V3d1K9PqRcFhZ9Xm/);
});
