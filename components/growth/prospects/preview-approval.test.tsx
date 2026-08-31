import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { PreviewApprovalFrame } from "./preview-approval";

test("offers a founder approval action for a draft preview", () => {
  const html = renderToStaticMarkup(
    <PreviewApprovalFrame
      businessName="Example Heating Ltd"
      onSuccess={() => undefined}
      preview={{
        status: "draft",
        slug: "example-heating",
        version: 1,
        compositionDigest: "a".repeat(64),
        generationStatus: "merged_draft",
        generationPrNumber: 412,
      }}
      prospectId="11111111-1111-4111-8111-111111111111"
      prospectVersion={3}
      prospectStatus="ready_for_email_review"
    />,
  );

  assert.match(html, />Approve preview<\/button>/);
  assert.match(html, /concept was made for Example Heating Ltd/);
});

test("opens a draft concept preview by slug", () => {
  const html = renderToStaticMarkup(
    <PreviewApprovalFrame
      businessName="Example Heating Ltd"
      onSuccess={() => undefined}
      preview={{
        status: "draft",
        slug: "example-heating",
        version: 1,
        compositionDigest: "a".repeat(64),
        generationStatus: "merged_draft",
        generationPrNumber: 412,
      }}
      prospectId="11111111-1111-4111-8111-111111111111"
      prospectVersion={3}
      prospectStatus="ready_for_email_review"
    />,
  );

  assert.match(
    html,
    /href="\/preview\/example-heating"/,
  );
  assert.match(html, />View concept preview</);
});

test("opens a known bespoke draft concept by business name when the stored slug is missing", () => {
  const html = renderToStaticMarkup(
    <PreviewApprovalFrame
      businessName="Bright Accounting Ltd"
      onSuccess={() => undefined}
      preview={{
        status: "draft",
        slug: null,
        version: 1,
        compositionDigest: "a".repeat(64),
        generationStatus: "merged_draft",
        generationPrNumber: 412,
      }}
      prospectId="11111111-1111-4111-8111-111111111111"
      prospectVersion={3}
      prospectStatus="ready_for_email_review"
    />,
  );

  assert.match(html, /concept was made for Bright Accounting Ltd/);
  assert.match(html, /href="\/preview\/bright-accounting"/);
  assert.match(html, />View concept preview</);
});

test("opens Doorknobs at its bespoke concept route when the stored slug is missing", () => {
  const html = renderToStaticMarkup(
    <PreviewApprovalFrame
      businessName="Doorknobs Limited"
      onSuccess={() => undefined}
      preview={{
        status: "draft",
        slug: null,
        version: 1,
        compositionDigest: "a".repeat(64),
        generationStatus: "merged_draft",
        generationPrNumber: 169,
      }}
      prospectId="fed7f3ad-b90c-47ce-a64f-308b7bfe847d"
      prospectVersion={1}
      prospectStatus="ready_for_email_review"
    />,
  );

  assert.match(html, /href="\/preview\/doorknobs"/);
  assert.match(html, />View concept preview</);
});

test("treats a registered bespoke concept as ready for founder approval", () => {
  const html = renderToStaticMarkup(
    <PreviewApprovalFrame
      businessName="Bright Accounting"
      onSuccess={() => undefined}
      preview={{
        status: "draft",
        slug: null,
        version: 1,
        compositionDigest: null,
        generationStatus: "composition_unavailable",
        generationPrNumber: null,
      }}
      prospectId="11111111-1111-4111-8111-111111111111"
      prospectVersion={3}
      prospectStatus="ready_for_email_review"
    />,
  );
  const approveButton = html.match(/<button[^>]*>Approve preview<\/button>/)?.[0];

  assert.ok(approveButton);
  assert.doesNotMatch(approveButton, /disabled=/);
  assert.match(html, /Bespoke preview is registered and ready for approval/);
  assert.doesNotMatch(html, /needs a bespoke source package/);
});

test("treats registered bespoke concepts as ready while generation reconciliation is pending", () => {
  for (const { businessName, slug } of [
    { businessName: "PRIORITY POINT LIMITED", slug: "priority-point" },
    { businessName: "BRIDGLAND LIMITED", slug: "bridgland-roofing" },
  ]) {
    const html = renderToStaticMarkup(
      <PreviewApprovalFrame
        businessName={businessName}
        onSuccess={() => undefined}
        preview={{
          status: "draft",
          slug: null,
          version: 1,
          compositionDigest: null,
          generationStatus: "pending_pr",
          generationPrNumber: null,
        }}
        prospectId="11111111-1111-4111-8111-111111111111"
        prospectVersion={3}
        prospectStatus="ready_for_email_review"
      />,
    );
    const approveButton = html.match(
      /<button[^>]*>Approve preview<\/button>/,
    )?.[0];

    assert.ok(approveButton);
    assert.doesNotMatch(approveButton, /disabled=/);
    assert.match(html, new RegExp(`href="/preview/${slug}"`));
    assert.match(html, /Bespoke preview is registered and ready for approval/);
  }
});

test("keeps bespoke approval unavailable when the stored slug conflicts", () => {
  const html = renderToStaticMarkup(
    <PreviewApprovalFrame
      businessName="Bright Accounting"
      onSuccess={() => undefined}
      preview={{
        status: "draft",
        slug: "other-preview",
        version: 1,
        compositionDigest: null,
        generationStatus: "composition_unavailable",
        generationPrNumber: null,
      }}
      prospectId="11111111-1111-4111-8111-111111111111"
      prospectVersion={3}
      prospectStatus="ready_for_email_review"
    />,
  );
  const approveButton = html.match(/<button[^>]*>Approve preview<\/button>/)?.[0];

  assert.ok(approveButton);
  assert.match(approveButton, /disabled=/);
  assert.match(html, /needs a bespoke source package/);
});

test("does not expose generated database-only preview links", () => {
  const html = renderToStaticMarkup(
    <PreviewApprovalFrame
      businessName="Example Heating Ltd"
      onSuccess={() => undefined}
      preview={{
        status: "draft",
        slug: null,
        version: 1,
        compositionDigest: "a".repeat(64),
        generationStatus: "merged_draft",
        generationPrNumber: 412,
      }}
      prospectId="11111111-1111-4111-8111-111111111111"
      prospectVersion={3}
      prospectStatus="ready_for_email_review"
    />,
  );

  assert.doesNotMatch(html, /\/growth\/prospects\/11111111-1111-4111-8111-111111111111\/preview/);
  assert.doesNotMatch(html, />View concept preview</);
});

test("does not expose a published preview identifier in the founder UI", () => {
  const html = renderToStaticMarkup(
    <PreviewApprovalFrame
      businessName="Example Heating Ltd"
      onSuccess={() => undefined}
      preview={{
        status: "published",
        slug: "example-heating",
        version: 2,
        compositionDigest: "a".repeat(64),
        generationStatus: "published",
        generationPrNumber: 412,
      }}
      prospectId="11111111-1111-4111-8111-111111111111"
      prospectVersion={4}
      prospectStatus="ready_for_email_review"
    />,
  );

  assert.match(html, /Preview published/);
  assert.doesNotMatch(html, /Q2VhN4A7x6Y0-5s8V3d1K9PqRcFhZ9Xm/);
});

test("keeps approval unavailable while the source package is awaiting merge", () => {
  const html = renderToStaticMarkup(
    <PreviewApprovalFrame
      businessName="Example Heating Ltd"
      onSuccess={() => undefined}
      preview={{
        status: "draft",
        slug: "example-heating",
        version: 1,
        compositionDigest: "a".repeat(64),
        generationStatus: "pr_open",
        generationPrNumber: 412,
      }}
      prospectId="11111111-1111-4111-8111-111111111111"
      prospectVersion={3}
      prospectStatus="ready_for_email_review"
    />,
  );

  assert.match(html, /Source package is awaiting PR #412 merge/);
  assert.match(html, /disabled=""[^>]*>Approve preview/);
});

test("allows feedback against the exact package while it is in review", () => {
  const html = renderToStaticMarkup(
    <PreviewApprovalFrame
      businessName="Example Heating Ltd"
      onSuccess={() => undefined}
      preview={{
        status: "draft",
        slug: "example-heating",
        version: 1,
        compositionDigest: "a".repeat(64),
        generationStatus: "pr_open",
        generationPrNumber: 412,
      }}
      prospectId="11111111-1111-4111-8111-111111111111"
      prospectVersion={3}
      prospectStatus="ready_for_email_review"
    />,
  );

  assert.match(html, /Suggest changes/);
  assert.match(html, /Request changes/);
  assert.match(html, /name="preview-change-notes"/);
});
