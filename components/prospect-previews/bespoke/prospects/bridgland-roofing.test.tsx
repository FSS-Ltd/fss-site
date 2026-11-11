import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { getActiveAnalysisPoint } from "./bridgland-roofing-hero";
import { BridglandRoofingPage } from "./bridgland-roofing";

test("renders Bridgland's roof-inspection journey without an unverified logo", () => {
  const html = renderToStaticMarkup(<BridglandRoofingPage />);

  assert.match(html, /data-bespoke-prospect="bridgland-roofing"/);
  assert.match(html, /data-bridgland-drone-journey="true"/);
  assert.match(html, /data-bridgland-analysis-marker="true"/);
  assert.match(html, /data-bridgland-analysis-hud="true"/);
  assert.match(html, /Aerial roof scan/);
  assert.match(html, /data-bridgland-analysis-sweep="true"/);
  assert.doesNotMatch(html, /bridgland-roofing%2Flogo\.png/);
  assert.match(html, /bridgland-roofing\/hero-wide-v1\.png/);
  assert.match(html, /roof-inspection-drone-v1\.mp4/);
  assert.match(html, /Listed buildings/);
  assert.match(html, /Roof assessments/);
  assert.match(html, /data-demo-form="Bridgland Roofing"/);
  assert.doesNotMatch(html, /bridglandPrimaryCta/);
  assert.equal((html.match(/<h1/g) ?? []).length, 1);
});

test("maps the drone path to distinct roof-inspection points", () => {
  assert.equal(getActiveAnalysisPoint(0), 0);
  assert.equal(getActiveAnalysisPoint(0.27), 1);
  assert.equal(getActiveAnalysisPoint(0.56), 2);
  assert.equal(getActiveAnalysisPoint(1), 3);
});

test("keeps the drone journey contained and supplies a reduced-motion fallback", () => {
  const styles = readFileSync(
    new URL("../../../../app/preview/preview.css", import.meta.url),
    "utf8",
  );

  assert.match(styles, /\[data-bridgland-drone-journey\]\s*\{\s*height:\s*400svh;/);
  assert.match(
    styles,
    /\[data-bridgland-drone-frame\] \{[\s\S]*?position:\s*sticky;/,
  );
  assert.match(
    styles,
    /\[data-bridgland-drone-video\][\s\S]*?object-fit:\s*contain;/,
  );
  assert.match(
    styles,
    /\[data-bridgland-drone-copy\]\s*\{[\s\S]*?top:\s*clamp\(7\.75rem/,
  );
  assert.doesNotMatch(styles, /\.bridglandPrimaryCta/);
  assert.match(styles, /\.bridglandAnalysisMarker::before/);
  assert.match(styles, /\.bridglandAnalysisHud/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)/);
});

test("ships the prepared Bridgland image and video assets", () => {
  const assetBase = new URL(
    "../../../../public/prospect-previews/bespoke/bridgland-roofing/",
    import.meta.url,
  );

  assert.equal(existsSync(new URL("hero-wide-v1.png", assetBase)), true);
  assert.equal(
    existsSync(new URL("roof-inspection-drone-v1.mp4", assetBase)),
    true,
  );
});
