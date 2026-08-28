import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import nextConfig from "../../next.config";
import ProspectPreviewPage, {
  dynamic,
  generateMetadata,
} from "./[slug]/page";

test("keeps preview rendering dynamic for publication status checks", async () => {
  assert.equal(dynamic, "force-dynamic");
});

test("marks prospect preview metadata as noindex and nofollow", async () => {
  const metadata = await generateMetadata({
    params: Promise.resolve({ slug: "marden-garage" }),
  });

  assert.equal(metadata.title, "MOT, service and repair in Marden");
  assert.deepEqual(metadata.robots, { index: false, follow: false });
});

test("sends noindex response headers for every preview URL", async () => {
  const configuredHeaders = await nextConfig.headers?.();
  const previewHeaders = configuredHeaders?.find(
    (entry) => entry.source === "/preview/:path*",
  );

  assert.deepEqual(previewHeaders?.headers, [
    { key: "X-Robots-Tag", value: "noindex, nofollow" },
  ]);
});

test("renders the selected bespoke concept instead of the public site shell", async () => {
  const page = await ProspectPreviewPage({
    params: Promise.resolve({ slug: "marden-garage" }),
  });
  const html = renderToStaticMarkup(page);

  assert.match(html, /Concept prepared for Marden Garage/i);
  assert.match(html, /Start with the vehicle/i);
  assert.doesNotMatch(html, /Faithful Software Solutions Ltd/i);
});
