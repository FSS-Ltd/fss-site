import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { BestRoofingPage } from "./best-roofing";
import { shouldEnableRoofBuildScroll } from "./roof-build-scroll-hero";
import { TunbridgeWellsRoofingPage } from "./tunbridge-wells-roofing";

test("waits for a decoded desktop video frame before scroll scrubbing", () => {
  assert.equal(shouldEnableRoofBuildScroll(false, 768, 2), true);
  assert.equal(shouldEnableRoofBuildScroll(false, 767, 4), false);
  assert.equal(shouldEnableRoofBuildScroll(true, 1440, 4), false);
  assert.equal(shouldEnableRoofBuildScroll(false, 1440, 1), false);
});

test("renders the shared roof-build journey in both requested roofing previews", () => {
  for (const Page of [BestRoofingPage, TunbridgeWellsRoofingPage]) {
    const html = renderToStaticMarkup(<Page />);
    const root = html.match(
      /<div[^>]*data-bespoke-prospect="(?:best-roofing|tunbridge-wells-roofing)"[^>]*>/,
    );

    assert.ok(root);
    assert.doesNotMatch(root[0], /overflow-x-hidden/);
    assert.match(html, /data-roof-build-scroll="true"/);
    assert.match(html, /data-roof-build-scroll-video="true"/);
    assert.match(html, /roof-restoration-scroll-scrub-v1\.mp4/);
    assert.match(html, /roof-restoration-v1-poster\.jpg/);
    assert.match(html, /<video[^>]*preload="auto"/);
    assert.doesNotMatch(html, /<video[^>]*autoPlay/);
  }
});
