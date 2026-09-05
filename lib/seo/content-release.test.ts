import assert from "node:assert/strict";
import test from "node:test";
import { access } from "node:fs/promises";
import path from "node:path";
import {
  getAllBlogPosts,
  getBlogPostBySlug,
  getRelatedPosts,
} from "@/lib/blog";
import { getAllResources, getResourceBySlug } from "@/lib/resources";
import nextConfig from "@/next.config";

const legacy = ["sdk-integration-playbook", "technical-content-lead-pipeline"];

test("substantive articles and resources expose evidence and contextual next steps", async () => {
  const posts = await getAllBlogPosts();
  assert.ok(
    posts.some((post) => post.slug === "church-management-software-vs-bespoke"),
  );
  const resources = await getAllResources();
  for (const item of [...posts, ...resources].filter(
    (item) => !legacy.includes(item.slug),
  )) {
    assert.ok(item.publishDate, item.slug);
    assert.ok(item.author, item.slug);
    assert.ok(item.authorUrl, item.slug);
    assert.ok(item.summary, item.slug);
    assert.ok(item.audience?.length, item.slug);
    assert.ok(item.sources?.length, item.slug);
    const content =
      "excerpt" in item
        ? await getBlogPostBySlug(item.slug)
        : await getResourceBySlug(item.slug);
    assert.ok(content);
    const links = [...content.body.matchAll(/\]\((\/[^)]+)\)/g)];
    assert.ok(
      links.length >= 3 && links.length <= 5,
      `${item.slug}: ${links.length} contextual links`,
    );
  }
});

test("legacy articles stay served without receiving new related-post promotion", async () => {
  for (const slug of legacy) assert.ok(await getBlogPostBySlug(slug));
  const posts = await getAllBlogPosts();
  for (const post of posts.filter((item) => !legacy.includes(item.slug))) {
    assert.ok(
      (await getRelatedPosts(post)).every(
        (related) => !legacy.includes(related.slug),
      ),
    );
  }
});

test("old resource slugs redirect permanently to complete replacements", async () => {
  const redirects = await nextConfig.redirects?.();
  for (const [oldSlug, newSlug] of [
    ["sdk-integration-readiness-kit", "software-project-readiness-kit"],
    ["technical-content-conversion-playbook", "software-investment-framework"],
  ]) {
    assert.ok(
      redirects?.some(
        (redirect) =>
          redirect.source === `/resources/${oldSlug}/:path*` &&
          redirect.destination === `/resources/${newSlug}/:path*` &&
          redirect.permanent,
      ),
    );
    const resource = await getResourceBySlug(newSlug);
    assert.ok(resource);
    assert.ok(resource.body.length > 1500);
    assert.ok(resource.meta.delivery.url);
    await access(
      path.join(
        process.cwd(),
        "public",
        decodeURIComponent(resource.meta.delivery.url),
      ),
    );
  }
});
