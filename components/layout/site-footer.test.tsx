import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { SiteFooter } from "./site-footer";

test("offers the privacy notice and a persistent cookie settings control", () => {
  const html = renderToStaticMarkup(<SiteFooter />);

  assert.match(html, /href="\/privacy"/);
  assert.match(html, />Privacy<\/a>/);
  assert.match(html, /<button[^>]*>Cookie settings<\/button>/);
});

test("footer copy avoids em dashes and shares the public page gutter", () => {
  const html = renderToStaticMarkup(<SiteFooter />);

  assert.doesNotMatch(html, /—/);
  assert.match(html, /private AI\. Built faithfully, in the UK\./);
  assert.match(html, /max\(24px, calc\(\(100% - 1120px\) \/ 2\)\)/);
});
