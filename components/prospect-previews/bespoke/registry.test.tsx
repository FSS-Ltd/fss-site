import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { resolveKnownBespokePreviewSlug } from "@/lib/growth/prospect-previews/preview-slugs";

import {
  bespokeProspectPages,
  getBespokeProspectPage,
  getBespokeProspectSlugs,
} from "./registry";
import { DunkleysOfDealPage } from "./prospects/dunkley-s-of-deal";

const expectedSlugs = [
  "bright-accounting",
  "bright-fox-lettings",
  "burfords",
  "dunkley-s-of-deal",
  "evo-kent-roofing",
  "fuggles-beer-cafe",
  "hide-and-fox",
  "jaguar-plumbing",
  "kent-garage-equipment",
  "marden-garage",
  "paperstone",
  "primeline-roofing",
  "sealeys-walker-jarvis",
  "wormald-accountants",
] as const;

test("registers exactly the fourteen active bespoke prospect pages", () => {
  assert.deepEqual(
    [...getBespokeProspectSlugs()].sort(),
    [...expectedSlugs].sort(),
  );
  assert.equal(getBespokeProspectPage("macknade"), undefined);
});

test("every prospect owns a distinct layout and hero-scene signature", () => {
  const entries = Object.values(bespokeProspectPages);

  assert.equal(new Set(entries.map((entry) => entry.layoutSignature)).size, 14);
  assert.equal(new Set(entries.map((entry) => entry.heroSignature)).size, 14);
});

test("every bespoke prospect page is recognised by the Growth OS preview resolver", () => {
  for (const [slug, entry] of Object.entries(bespokeProspectPages)) {
    assert.equal(resolveKnownBespokePreviewSlug(entry.businessName), slug);
  }
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

test("renders Dunkley's photographic hero as an immersive scroll introduction", () => {
  const html = renderToStaticMarkup(<DunkleysOfDealPage />);

  assert.match(html, /data-dunkley-scroll-hero="true"/);
  assert.match(html, /data-dunkley-scroll-hero-media="true"/);
  assert.match(html, /data-dunkley-scroll-hero-copy="true"/);
  assert.match(html, /dunkley-s-of-deal%2Fhero-v1\.png/);
});

test("keeps Dunkley's scroll transition compact before vehicle booking", () => {
  const html = renderToStaticMarkup(<DunkleysOfDealPage />);
  const styles = readFileSync(
    new URL("../../../app/preview/preview.css", import.meta.url),
    "utf8",
  );

  assert.match(
    styles,
    /\[data-dunkley-scroll-hero\] \{\s+height: 145svh;/,
  );
  assert.match(
    styles,
    /\[data-dunkley-scroll-hero\] \+ #vehicle \{\s+margin-top: -100svh;/,
  );
  assert.match(
    styles,
    /\[data-dunkley-scroll-hero-frame\] \{[\s\S]*?pointer-events: none;/,
  );
  assert.match(
    styles,
    /\[data-dunkley-scroll-hero\] \{\s+height: 145svh;[\s\S]*?pointer-events: none;/,
  );

  const formIndex = html.indexOf('data-demo-form="Dunkley&#x27;s of Deal"');
  assert.ok(formIndex > 0);
  assert.doesNotMatch(html.slice(formIndex - 160, formIndex), /prospect-reveal/);
});

test("renders Bright Accounting as a premium evidence-led demo", () => {
  const entry = getBespokeProspectPage("bright-accounting");
  assert.ok(entry);

  const html = renderToStaticMarkup(<entry.Page />);

  assert.match(html, /data-bespoke-prospect="bright-accounting"/);
  assert.match(html, /expired on 21 October 2021/i);
  assert.match(html, /Bookkeeping &amp; VAT/i);
  assert.match(html, /Personal Tax/i);
  assert.match(html, /Sole Trader/i);
  assert.match(html, /Limited Company/i);
  assert.match(html, /Demonstration only/i);
  assert.match(html, /not currently connected to.*live systems/i);
  assert.match(html, /bright-accounting%2Fhero-ledger-v1\.webp/);
  assert.match(html, /bright-accounting%2Fclient-desk-v1\.webp/);
  assert.match(html, /bright-accounting%2Fdeadline-object-v1\.webp/);
});
