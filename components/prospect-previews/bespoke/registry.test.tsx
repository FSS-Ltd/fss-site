import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import {
  bespokeProspectPages,
  getBespokeProspectPage,
  getBespokeProspectSlugs,
} from "./registry";

const expectedSlugs = [
  "bright-fox-lettings",
  "burfords",
  "dunkley-s-of-deal",
  "evo-kent-roofing",
  "fuggles-beer-cafe",
  "hide-and-fox",
  "kent-garage-equipment",
  "marden-garage",
  "paperstone",
  "primeline-roofing",
  "sealeys-walker-jarvis",
  "wormald-accountants",
] as const;

test("registers exactly the twelve active bespoke prospect pages", () => {
  assert.deepEqual(
    [...getBespokeProspectSlugs()].sort(),
    [...expectedSlugs].sort(),
  );
  assert.equal(getBespokeProspectPage("macknade"), undefined);
});

test("every prospect owns a distinct layout and hero-scene signature", () => {
  const entries = Object.values(bespokeProspectPages);

  assert.equal(new Set(entries.map((entry) => entry.layoutSignature)).size, 12);
  assert.equal(new Set(entries.map((entry) => entry.heroSignature)).size, 12);
});

test("every page renders its evidence-backed statement and a disclosed demo form", () => {
  for (const slug of expectedSlugs) {
    const entry = getBespokeProspectPage(slug);
    assert.ok(entry);

    const html = renderToStaticMarkup(<entry.Page />);
    assert.match(html, new RegExp(`data-bespoke-prospect="${slug}"`));
    assert.match(html, /Demonstration only/i);
    assert.match(html, /not currently connected to.*live systems/i);
    assert.match(html, /<form/);
  }
});

test("garage journeys ask for registration before service details", () => {
  for (const slug of ["dunkley-s-of-deal", "marden-garage"] as const) {
    const entry = getBespokeProspectPage(slug);
    assert.ok(entry);
    const html = renderToStaticMarkup(<entry.Page />);

    assert.ok(
      html.indexOf("Vehicle registration") < html.indexOf("What do you need"),
    );
  }
});
