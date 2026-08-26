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
