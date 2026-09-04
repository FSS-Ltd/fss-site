import assert from "node:assert/strict";
import test from "node:test";

import sitemap, { buildSitemapEntries } from "@/app/sitemap";
import { blogFrontmatterSchema, getAllBlogPosts } from "@/lib/blog";
import { getAllResources } from "@/lib/resources";
import { buildRobots } from "./robots";
import { buildRssFeed } from "./rss";

test("public crawlers can read pages and noindex directives; preview deployments remain blocked", () => {
  assert.deepEqual(buildRobots(true), {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: "https://faithfulsoftware.dev/sitemap.xml",
  });
  assert.deepEqual(buildRobots(false), {
    rules: { userAgent: "*", disallow: "/" },
  });
});

test("sitemap includes about and privacy with source dates and excludes non-indexable routes", async () => {
  const entries = await sitemap();
  assert.equal(
    entries.find((entry) => entry.url.endsWith("/about"))?.lastModified,
    "2026-09-04",
  );
  assert.equal(
    entries.find((entry) => entry.url.endsWith("/privacy"))?.lastModified,
    "2026-08-26",
  );
  assert.equal(
    entries.some((entry) =>
      /\/(growth|preview|api)\b|thank-you/.test(entry.url),
    ),
    false,
  );
  assert.equal(new Set(entries.map((entry) => entry.url)).size, entries.length);
  for (const entry of entries)
    assert.match(String(entry.lastModified), /^\d{4}-\d{2}-\d{2}$/);
  const resources = await getAllResources();
  for (const resource of resources) {
    assert.equal(
      entries.find((entry) => entry.url.endsWith(`/resources/${resource.slug}`))
        ?.lastModified,
      resource.modifiedDate,
    );
  }
});

test("RSS publishes canonical article links and dates with escaped XML text", async () => {
  const posts = await getAllBlogPosts();
  const xml = buildRssFeed([
    {
      ...posts[0],
      title: 'Charities & "software" <guide>',
      excerpt: "A < B & C",
    },
  ]);
  assert.match(xml, /<rss version="2.0"/);
  assert.match(xml, /Charities &amp; &quot;software&quot; &lt;guide&gt;/);
  assert.match(xml, /A &lt; B &amp; C/);
  assert.match(xml, /<link>https:\/\/faithfulsoftware.dev\/blog\//);
  assert.match(xml, /<pubDate>[^<]+ GMT<\/pubDate>/);
  assert.equal((xml.match(/<item>/g) ?? []).length, 1);
});

test("sitemap excludes a non-indexable resource while retaining indexable resources", async () => {
  const resources = await getAllResources();
  const [resource] = resources;
  const entries = buildSitemapEntries(
    [],
    [
      ...resources,
      { ...resource, slug: "private-resource-fixture", indexable: false },
    ],
  );
  assert.equal(
    entries.some((entry) =>
      entry.url.endsWith("/resources/private-resource-fixture"),
    ),
    false,
  );
  assert.ok(
    entries.some((entry) => entry.url.endsWith(`/resources/${resource.slug}`)),
  );
});

test("new articles from the existing generator default modification to their publication date", async () => {
  const [post] = await getAllBlogPosts();
  const parsed = blogFrontmatterSchema.parse({
    ...post,
    modifiedDate: undefined,
  });
  assert.equal(parsed.modifiedDate, post.publishDate);
});
