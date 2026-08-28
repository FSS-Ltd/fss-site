import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { PrimelineRoofingPage } from "./primeline-roofing";

test("renders Primeline as a branded day-to-night roofing introduction", () => {
  const html = renderToStaticMarkup(<PrimelineRoofingPage />);

  assert.match(html, /data-primeline-hero="true"/);
  assert.match(html, /primeline-logo\.png/);
  assert.match(html, /hero-day-v1\.webp/);
  assert.match(html, /hero-night-v1\.webp/);
  assert.match(html, /A roof worth looking up at\./);
  assert.match(html, /Straight advice before the scaffold\./);
  assert.match(html, /Confidence built into every detail\./);
  assert.match(html, /From first photo to final ridge\./);
  assert.equal((html.match(/<h1/g) ?? []).length, 1);
});

test("keeps Primeline proof and quote flow tied to researched claims", () => {
  const html = renderToStaticMarkup(<PrimelineRoofingPage />);

  assert.match(html, /20\+/);
  assert.match(html, /TrustATrader rating/);
  assert.match(html, /Google rating/);
  assert.match(html, /Insurance backed guarantee/);
  assert.match(html, /data-demo-form="Primeline Roofing"/);
  assert.match(html, /Demonstration only · no details are sent/);
});

test("keeps Primeline scroll crossfade and reduced-motion fallback in preview CSS", () => {
  const styles = readFileSync(
    new URL("../../../../app/preview/preview.css", import.meta.url),
    "utf8",
  );

  assert.match(styles, /\[data-primeline-hero\]\s*\{\s*height: 320svh;/);
  assert.match(styles, /\[data-primeline-hero-frame\] \{[\s\S]*?position: sticky;/);
  assert.match(
    styles,
    /\[data-primeline-hero-night\] \{[\s\S]*?opacity: var\(--primeline-night-opacity\);/,
  );
  assert.match(
    styles,
    /\[data-primeline-copy-beat\]:first-child \{[\s\S]*?opacity: 1;/,
  );
  assert.match(styles, /\[data-primeline-copy-beat\] \{[\s\S]*?display: none;/);
});

test("ships the project-local Primeline visual assets", () => {
  const assetBase = new URL(
    "../../../../public/prospect-previews/bespoke/primeline-roofing/",
    import.meta.url,
  );

  assert.equal(existsSync(new URL("primeline-logo.png", assetBase)), true);
  assert.equal(existsSync(new URL("hero-day-v1.webp", assetBase)), true);
  assert.equal(existsSync(new URL("hero-night-v1.webp", assetBase)), true);
});
