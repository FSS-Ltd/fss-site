import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import ProspectPreviewPage, {
  generateMetadata,
  generateStaticParams,
} from "./[slug]/page";

test("prerenders the fifteen public-unlisted bespoke prospect slugs", () => {
  const params = generateStaticParams();
  const slugs: readonly string[] = params.map(({ slug }) => slug);

  assert.equal(params.length, 15);
  assert.equal(slugs.includes("bright-accounting"), true);
  assert.equal(slugs.includes("kemsing-motor-company"), true);
  assert.equal(slugs.includes("macknade"), false);
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
