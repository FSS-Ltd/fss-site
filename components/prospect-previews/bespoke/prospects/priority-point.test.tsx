import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { PriorityPointPage } from "./priority-point";

const assetBase = new URL(
  "../../../../public/prospect-previews/bespoke/priority-point/",
  import.meta.url,
);

test("renders Priority Point's responsibility-led accountancy journey", () => {
  const html = renderToStaticMarkup(<PriorityPointPage />);

  assert.match(html, /data-bespoke-prospect="priority-point"/);
  assert.match(html, /Licensed accountancy practice/i);
  assert.match(html, /Company registration/i);
  assert.match(html, /Bookkeeping/i);
  assert.match(html, /Payroll/i);
  assert.match(html, /VAT/i);
  assert.match(html, /CIS/i);
  assert.match(html, /Business structure/i);
  assert.match(html, /Next deadline/i);
  assert.match(html, /Demonstration only/i);
  assert.match(html, /not currently connected to.*live systems/i);
  assert.match(html, /priority-point%2Fbrief-board-v1\.webp/);
});

test("ships the logo, hero and accountancy-brief visual locally", () => {
  for (const filename of ["logo.png", "hero-v1.png", "brief-board-v1.webp"]) {
    assert.equal(existsSync(new URL(filename, assetBase)), true, filename);
  }
});
