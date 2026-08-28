import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { EvoKentRoofingPage } from "./evo-kent-roofing";

test("renders EVO's scroll-linked 1080p roof restoration with a poster fallback", () => {
  const html = renderToStaticMarkup(<EvoKentRoofingPage />);

  assert.match(html, /data-evo-roof-restoration="true"/);
  assert.match(
    html,
    /<section(?=[^>]*data-evo-roof-restoration="true")(?=[^>]*class="text-white")/,
  );
  const rootElement = html.match(
    /<div[^>]*data-bespoke-prospect="evo-kent-roofing"[^>]*>/,
  );
  assert.ok(rootElement);
  assert.doesNotMatch(rootElement[0], /overflow-hidden/);
  assert.match(
    html,
    /prospect-previews\/bespoke\/evo-kent-roofing\/roof-restoration-scroll-scrub-v1\.mp4/,
  );
  assert.match(
    html,
    /prospect-previews\/bespoke\/evo-kent-roofing\/roof-restoration-v1-poster\.jpg/,
  );
  assert.doesNotMatch(html, /<video[^>]*autoPlay/);
  assert.match(html, /Clear assessments\. Straight advice\./);
  assert.match(html, /Careful workmanship\. Roofs built to last\./);
  assert.match(html, /A damaged roof is rebuilt layer by layer/i);
});

test("gives EVO's video a longer scroll distance without autoplay", () => {
  const styles = readFileSync(
    new URL("../../../../app/preview/preview.css", import.meta.url),
    "utf8",
  );

  assert.match(
    styles,
    /\[data-evo-roof-restoration\]\s*\{\s*height:\s*420svh;/,
  );
});
