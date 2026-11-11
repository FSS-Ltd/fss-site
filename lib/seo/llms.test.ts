import assert from "node:assert/strict";
import test from "node:test";

import { buildLlmsTxt } from "./llms";
import type { BlogPostMeta } from "@/lib/types/blog";
import type { ResourceMeta } from "@/lib/types/resource";

const pages = {
  "/": { path: "/", title: "Home", description: "Home page.", index: true },
  "/services/private-ai": {
    path: "/services/private-ai",
    title: "Private AI",
    description: "Private AI service.",
    index: true,
  },
  "/guides/cost": {
    path: "/guides/cost",
    title: "Cost guide",
    description: "Cost guide.",
    index: true,
  },
  "/blog/post-a": {
    path: "/blog/post-a",
    title: "Duplicate of post",
    description: "Skipped, comes from the post list.",
    index: true,
  },
  "/privacy": {
    path: "/privacy",
    title: "Privacy",
    description: "Private page.",
    index: false,
  },
};

const posts = [
  {
    slug: "post-a",
    seoTitle: "Post A",
    seoDescription: "About A.",
    indexable: true,
  },
  {
    slug: "post-b",
    seoTitle: "Post B",
    seoDescription: "About B.",
    indexable: false,
  },
] as BlogPostMeta[];

const resources = [
  { slug: "kit", seoTitle: "Kit", seoDescription: "A kit.", indexable: true },
] as ResourceMeta[];

test("llms.txt lists indexable pages, posts and resources under sections with absolute URLs", () => {
  const text = buildLlmsTxt(pages, posts, resources);
  assert.ok(text.startsWith("# Faithful Software Solutions\n\n> "));
  assert.ok(
    text.includes(
      "UK studio building AI integration, automation and custom software for businesses of any size",
    ),
  );
  const headings = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(headings, [
    "Services",
    "Guides and case studies",
    "Articles",
    "Resources",
    "Company",
  ]);
  assert.ok(
    text.includes(
      "- [Private AI](https://faithfulsoftware.dev/services/private-ai): Private AI service.",
    ),
  );
  assert.ok(
    text.includes(
      "- [Cost guide](https://faithfulsoftware.dev/guides/cost): Cost guide.",
    ),
  );
  assert.ok(
    text.includes(
      "- [Post A](https://faithfulsoftware.dev/blog/post-a): About A.",
    ),
  );
  assert.ok(
    text.includes(
      "- [Kit](https://faithfulsoftware.dev/resources/kit): A kit.",
    ),
  );
  assert.ok(
    text.includes("- [Home](https://faithfulsoftware.dev): Home page."),
  );
});

test("llms.txt omits non-indexable entries and duplicates", () => {
  const text = buildLlmsTxt(pages, posts, resources);
  assert.equal(text.includes("Privacy"), false);
  assert.equal(text.includes("post-b"), false);
  assert.equal(text.includes("Duplicate of post"), false);
});
