import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {};
};

test("thank-you metadata is noindex follow even for an unavailable resource", async () => {
  const { generateMetadata } =
    require("./(site)/resources/[slug]/thank-you/page") as typeof import("./(site)/resources/[slug]/thank-you/page");
  for (const slug of ["manual-process-audit-fss", "missing"]) {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug }),
    });
    assert.deepEqual(metadata.robots, { index: false, follow: true });
  }
});

test("root schema renders one connected graph and escapes HTML-sensitive text", () => {
  const { RootSchema } =
    require("@/components/seo/root-schema") as typeof import("@/components/seo/root-schema");
  const { JsonLd } =
    require("@/components/seo/json-ld") as typeof import("@/components/seo/json-ld");
  const html = renderToStaticMarkup(<RootSchema />);
  assert.equal((html.match(/application\/ld\+json/g) ?? []).length, 1);
  assert.match(html, /"@graph"/);
  assert.doesNotMatch(
    renderToStaticMarkup(<JsonLd data={{ text: "</script><p>unsafe</p>" }} />),
    /<p>unsafe/,
  );
});

test("404 gives visitors a branded heading and routes back to home or contact", () => {
  const { default: NotFound } =
    require("./not-found") as typeof import("./not-found");
  const html = renderToStaticMarkup(<NotFound />);
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1);
  assert.match(html, /Faithful Software Solutions/);
  assert.match(html, /href="\/"/);
  assert.match(html, /href="\/contact"/);
});

test("article and resource metadata publish full social image descriptors and canonical titles", async () => {
  const { createArticleMetadata, createResourceMetadata } =
    await import("@/lib/seo/content-metadata");
  const { getBlogPostBySlug } = await import("@/lib/blog");
  const { getResourceBySlug } = await import("@/lib/resources");
  const post = await getBlogPostBySlug("sdk-integration-playbook");
  const resource = await getResourceBySlug("manual-process-audit-fss");
  assert.ok(post && resource);
  for (const [metadata, slug, section] of [
    [createArticleMetadata(post.meta), post.meta.slug, "blog"],
    [createResourceMetadata(resource.meta), resource.meta.slug, "resources"],
  ] as const) {
    assert.equal(typeof metadata.title, "object");
    assert.deepEqual(metadata.alternates, {
      canonical: `https://faithfulsoftware.dev/${section}/${slug}`,
      types: { "application/rss+xml": "https://faithfulsoftware.dev/feed.xml" },
    });
    const images = metadata.openGraph?.images;
    assert.ok(Array.isArray(images));
    assert.ok(
      images.some(
        (image) =>
          typeof image === "object" &&
          "width" in image &&
          image.width === 1200 &&
          image.height === 630,
      ),
    );
  }
});

test("public layout advertises RSS and default large social images", () => {
  const { metadata } =
    require("./(site)/layout") as typeof import("./(site)/layout");
  assert.deepEqual(metadata.alternates?.types, {
    "application/rss+xml": "https://faithfulsoftware.dev/feed.xml",
  });
  assert.ok(metadata.openGraph?.images);
  assert.ok(metadata.twitter?.images);
});
