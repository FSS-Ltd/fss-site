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

const { OutreachDrafts } =
  require("./outreach-drafts") as typeof import("./outreach-drafts");

test("offers draft review on desktop and mobile before any sequence has started", () => {
  const html = renderToStaticMarkup(
    <OutreachDrafts
      result={{
        status: "ready",
        rows: [
          {
            draftTaskId: "11111111-1111-4111-8111-111111111111",
            businessName: "Example Plumbing Ltd",
            contactName: "Alex Example",
            completedAt: "2026-10-25T06:00:00.000Z",
          },
        ],
      }}
    />,
  );
  const links = html.match(
    /<a[^>]*href="\/growth\/outreach\/messages\/11111111-1111-4111-8111-111111111111"[^>]*>Review &amp; publish<\/a>/g,
  );
  assert.equal(links?.length, 2);
  assert.match(html, /class="table"/);
  assert.match(html, /class="mobileList"/);
  assert.match(html, /Example Plumbing Ltd/);
  assert.match(html, /Alex Example/);
  assert.match(
    html,
    /<button[^>]*aria-haspopup="dialog"[^>]*>Send all<\/button>/,
  );
});

test("keeps draft empty and failure states visible", () => {
  const empty = renderToStaticMarkup(
    <OutreachDrafts result={{ status: "ready", rows: [] }} />,
  );
  assert.match(empty, /Email drafts/);
  assert.match(empty, /No email drafts are waiting for review/);

  const failure = renderToStaticMarkup(
    <OutreachDrafts
      result={{
        status: "error",
        message: "Email drafts could not load.",
        correlationId: "draft-reference",
      }}
    />,
  );
  assert.match(failure, /role="alert"/);
  assert.match(failure, /draft-reference/);
  assert.doesNotMatch(failure, /No email drafts/);
});

test("shows only ten drafts per page while retaining the full queue for batch review", () => {
  const rows = Array.from({ length: 13 }, (_, index) => ({
    draftTaskId: `draft-${index + 1}`,
    businessName: `Example ${index + 1}`,
    contactName: "Business contact",
    completedAt: "2026-10-26T08:00:00Z",
  }));
  const html = renderToStaticMarkup(
    <OutreachDrafts result={{ status: "ready", rows }} />,
  );
  assert.match(html, /Showing 1–10 of 13 drafts/);
  assert.match(html, /Page 1 of 2/);
  assert.match(html, /draft-10/);
  assert.doesNotMatch(html, /draft-11/);
  assert.match(html, /Send all covers all 13 drafts across pages/);
});
