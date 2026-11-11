import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { KentGarageEquipmentPage } from "./kent-garage-equipment";

test("renders Kent Garage Equipment as a four-scene workshop introduction", () => {
  const html = renderToStaticMarkup(<KentGarageEquipmentPage />);

  assert.match(html, /data-kge-scroll-hero="true"/);
  assert.match(html, /kge-logo-v1\.png/);
  assert.match(html, /mot-installation-v2\.webp/);
  assert.match(html, /vehicle-lifts-v2\.webp/);
  assert.match(html, /garage-cabinets-v2\.webp/);
  assert.match(html, /alignment-station-v2\.webp/);
  assert.equal((html.match(/<h1/g) ?? []).length, 1);
});

test("keeps the project demonstration and FSS contact route", () => {
  const html = renderToStaticMarkup(<KentGarageEquipmentPage />);

  assert.match(html, /data-demo-form="Kent Garage Equipment"/);
  assert.match(html, /Demonstration only · no details are sent/);
  assert.match(html, /href="\/contact"[^>]*>Talk to FSS/);
  assert.match(html, /Plan a project/);
});

test("keeps workshop transitions within a single extra viewport", () => {
  const styles = readFileSync(
    new URL("../../../../app/preview/preview.css", import.meta.url),
    "utf8",
  );

  assert.match(styles, /\.kgeTrack \{\s+height: 200svh;/);
  assert.match(styles, /\.kgeViewport \{[\s\S]*?position: sticky;/);
  assert.match(styles, /\.kgeScene\[data-state="active"\] \{[\s\S]*?opacity: 1;/);
});

test("does not clip the sticky workshop hero", () => {
  const html = renderToStaticMarkup(<KentGarageEquipmentPage />);

  assert.match(html, /class="kgePage min-h-screen(?: |\")/);
  assert.doesNotMatch(html, /class="[^\"]*kgePage[^\"]*overflow-hidden/);
});
