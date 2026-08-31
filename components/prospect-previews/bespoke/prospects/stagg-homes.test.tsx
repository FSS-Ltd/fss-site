import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { getBespokeProspectPage } from "../registry";
import { StaggHomesPage } from "./stagg-homes";

test("renders Stagg's scroll-linked property journey with a static fallback", () => {
  const html = renderToStaticMarkup(<StaggHomesPage />);

  assert.match(html, /data-bespoke-prospect="stagg-homes"/);
  assert.match(html, /data-stagg-property-journey="true"/);
  assert.match(html, /property-walkthrough-scroll-scrub-v1\.mp4/);
  assert.match(html, /hero-v1\.png/);
  assert.doesNotMatch(html, /<video[^>]*autoPlay/);
  assert.match(html, /Request a valuation/);
  assert.match(html, /A move deserves more than a transaction\./);

  const journeyRoot = html.match(
    /<section[^>]*data-stagg-property-journey="true"[^>]*>/,
  );
  assert.ok(journeyRoot);
  assert.match(journeyRoot[0], /h-svh/);
  assert.doesNotMatch(journeyRoot[0], /h-\[340svh\]/);
});

test("registers the Stagg Homes concept as a private bespoke preview", () => {
  const page = getBespokeProspectPage("stagg-homes");

  assert.equal(page?.Page, StaggHomesPage);
  assert.match(page?.title ?? "", /owner-led property/i);
  assert.match(page?.description ?? "", /point of contact/i);
});
