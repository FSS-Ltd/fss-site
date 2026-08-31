import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import ProspectPreviewPage, {
  generateMetadata,
  generateStaticParams,
} from "./[slug]/page";

test("prerenders the seventeen public-unlisted bespoke prospect slugs", () => {
  const params = generateStaticParams();
  const slugs: readonly string[] = params.map(({ slug }) => slug);

  assert.equal(params.length, 17);
  assert.equal(slugs.includes("bright-accounting"), true);
  assert.equal(slugs.includes("doorknobs"), true);
  assert.equal(slugs.includes("kemsing-motor-company"), true);
  assert.equal(slugs.includes("priority-point"), true);
  assert.equal(slugs.includes("macknade"), false);
});

test("resolves Priority Point's accountancy journey and metadata", async () => {
  const page = await ProspectPreviewPage({
    params: Promise.resolve({ slug: "priority-point" }),
  });
  const html = renderToStaticMarkup(page);
  const metadata = await generateMetadata({
    params: Promise.resolve({ slug: "priority-point" }),
  });

  assert.match(html, /data-bespoke-prospect="priority-point"/);
  assert.match(html, /Company registration/i);
  assert.match(String(metadata.title), /Priority Point/i);
  assert.match(String(metadata.description), /accountancy/i);
  assert.deepEqual(metadata.robots, { index: false, follow: false });
});

test("resolves a merged bespoke page without a published database record", async () => {
  const page = await ProspectPreviewPage({
    params: Promise.resolve({ slug: "marden-garage" }),
  });
  const html = renderToStaticMarkup(page);

  assert.match(html, /data-bespoke-prospect="marden-garage"/);
  assert.match(html, /Vehicle registration/);
});

test("keeps bespoke pages out of search while providing page-specific metadata", async () => {
  const metadata = await generateMetadata({
    params: Promise.resolve({ slug: "fuggles-beer-cafe" }),
  });

  assert.match(String(metadata.title), /Beer, food and group bookings/);
  assert.match(String(metadata.description), /Thirty beers on tap/);
  assert.deepEqual(metadata.robots, { index: false, follow: false });
});

test("resolves the Bright Accounting bespoke page and metadata", async () => {
  const page = await ProspectPreviewPage({
    params: Promise.resolve({ slug: "bright-accounting" }),
  });
  const html = renderToStaticMarkup(page);
  const metadata = await generateMetadata({
    params: Promise.resolve({ slug: "bright-accounting" }),
  });

  assert.match(html, /data-bespoke-prospect="bright-accounting"/);
  assert.match(html, /expired on 21 October 2021/i);
  assert.match(String(metadata.title), /Bright Accounting/i);
  assert.match(String(metadata.description), /fixed-fee/i);
  assert.deepEqual(metadata.robots, { index: false, follow: false });
});

test("resolves Kemsing's royal-blue evidence-led bespoke page and metadata", async () => {
  const page = await ProspectPreviewPage({
    params: Promise.resolve({ slug: "kemsing-motor-company" }),
  });
  const html = renderToStaticMarkup(page);
  const metadata = await generateMetadata({
    params: Promise.resolve({ slug: "kemsing-motor-company" }),
  });

  assert.match(html, /data-bespoke-prospect="kemsing-motor-company"/);
  assert.match(
    String(metadata.title),
    /MOT, diagnostics and vehicle servicing/i,
  );
  assert.match(
    String(metadata.description),
    /vehicle details Kemsing Motor Company needs/i,
  );
  assert.deepEqual(metadata.robots, { index: false, follow: false });
});

test("renders Doorknobs as a bespoke property navigator with local assets and demo disclosure", async () => {
  const page = await ProspectPreviewPage({
    params: Promise.resolve({ slug: "doorknobs" }),
  });
  const html = renderToStaticMarkup(page);
  const metadata = await generateMetadata({
    params: Promise.resolve({ slug: "doorknobs" }),
  });

  assert.match(html, /data-bespoke-prospect="doorknobs"/);
  assert.match(html, /doorknobs-logo-v1\.png/);
  assert.match(html, /property-threshold-v1\.webp/);
  assert.match(html, /landlord-care-v1\.webp/);
  assert.match(html, /local-home-detail-v1\.webp/);
  assert.match(html, /Letting a property/);
  assert.match(html, /Let Only/);
  assert.match(html, /Rent Collection/);
  assert.match(html, /Full Management/);
  assert.match(html, /data-demo-form="Doorknobs"/);
  assert.match(String(metadata.title), /Tunbridge Wells/i);
  assert.match(String(metadata.description), /property/i);
  assert.deepEqual(metadata.robots, { index: false, follow: false });
});
