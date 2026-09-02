import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { BestRoofingPage } from "./best-roofing";
import { TunbridgeWellsRoofingPage } from "./tunbridge-wells-roofing";

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
    assert.doesNotMatch(html, /<video[^>]*autoPlay/);
  }
});
