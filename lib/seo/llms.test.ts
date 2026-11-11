import assert from "node:assert/strict";
import test from "node:test";

import { buildLlmsTxt, llmsTxtResponse } from "./llms";
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
    "Pages",
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

test("llms.txt collapses whitespace and omits empty sections", () => {
  const text = buildLlmsTxt(
    {
      "/": {
        path: "/",
        title: "Home\n  page",
        description: "Line one.\n\nLine   two.",
        index: true,
      },
    },
    [],
    [],
  );
  assert.ok(
    text.includes(
      "- [Home page](https://faithfulsoftware.dev): Line one. Line two.",
    ),
  );
  assert.deepEqual(
    [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]),
    ["Pages"],
  );
});

test("llms.txt response is 404 on preview deployments and nosniff plain text in production", async () => {
  let built = false;
  const preview = llmsTxtResponse(false, () => {
    built = true;
    return "x";
  });
  assert.equal(preview.status, 404);
  assert.equal(built, false);
  const live = llmsTxtResponse(true, () => "# Body\n");
  assert.equal(live.status, 200);
  assert.equal(live.headers.get("Content-Type"), "text/plain; charset=utf-8");
  assert.equal(live.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(await live.text(), "# Body\n");
});

test("llms.txt omits non-indexable entries and duplicates", () => {
  const text = buildLlmsTxt(pages, posts, resources);
  assert.equal(text.includes("Privacy"), false);
  assert.equal(text.includes("post-b"), false);
  assert.equal(text.includes("Duplicate of post"), false);
});
