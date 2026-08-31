import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { WormaldAccountantsPage } from "./wormald-accountants";

test("renders Wormald as a researched quiet-precision accountancy experience", () => {
  const html = renderToStaticMarkup(<WormaldAccountantsPage />);

  assert.match(html, /data-bespoke-prospect="wormald-accountants"/);
  assert.match(html, /wormald-logo\.png/);
  assert.match(html, /width="500"/);
  assert.match(html, /height="43"/);
  assert.equal((html.match(/<h1/g) ?? []).length, 1);
  assert.match(html, /Making sense of your numbers/);
  assert.match(html, /over a quarter of a century/i);
  assert.match(html, /individual basis/i);
  assert.match(html, /Maidstone/);
  assert.match(html, /04922533/);
  assert.doesNotMatch(html, /WORMALD\+/);
});

test("presents Wormald's three verified service pillars and guided enquiry", () => {
  const html = renderToStaticMarkup(<WormaldAccountantsPage />);

  assert.match(html, />Compliance</);
  assert.match(html, /Annual accounts/);
  assert.match(html, /Payroll and CIS filing/);
  assert.match(html, />Support</);
  assert.match(html, /Management accounts/);
  assert.match(html, /Financial analysis and data/i);
  assert.match(html, />Advising</);
  assert.match(html, /Corporate and personal taxes/i);
  assert.match(html, /Retirement and estate planning/i);
  assert.match(html, /data-demo-form="Wormald Accountants"/);
  assert.match(html, /What would you like help with\?/);
  assert.match(html, /Who is the advice for\?/);
  assert.match(html, /Is there a deadline\?/);
  assert.match(html, /Demonstration only · no details are sent/);
});

test("ships Wormald's official and generated project-local assets", () => {
  const assetBase = new URL(
    "../../../../public/prospect-previews/bespoke/wormald-accountants/",
    import.meta.url,
  );

  for (const asset of [
    "wormald-logo.png",
    "hero-ledger-v1.webp",
    "service-pillars-v1.webp",
    "clarity-brief-v1.webp",
  ]) {
    assert.equal(existsSync(new URL(asset, assetBase)), true, asset);
  }
});

test("defines Wormald's sticky clarity journey and reduced-motion fallback", () => {
  const styles = readFileSync(
    new URL("../../../../app/preview/wormald-accountants.css", import.meta.url),
    "utf8",
  );

  assert.match(styles, /\[data-wormald-clarity-journey\]/);
  assert.match(styles, /position:\s*sticky/);
  assert.match(styles, /view-timeline-name:\s*--wormald-journey/);
  assert.match(styles, /animation-timeline:\s*--wormald-journey/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(styles, /animation:\s*none !important/);
});
