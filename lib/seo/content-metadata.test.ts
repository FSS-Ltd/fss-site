import assert from "node:assert/strict";
import test from "node:test";

import type { BlogPostMeta } from "@/lib/types/blog";
import { createArticleMetadata } from "@/lib/seo/content-metadata";

const base = {
  slug: "a",
  title: "A",
  excerpt: "e",
  publishDate: "2026-01-01",
  modifiedDate: "2026-01-01",
  author: "FSS",
  category: "Growth",
  tags: ["x"],
  coverImage: "/c.svg",
  seoDescription: "d",
  featured: false,
  indexable: true,
  readingMinutes: 3,
} satisfies Omit<BlogPostMeta, "seoTitle">;

test("article titles carry the site suffix exactly once", () => {
  const plain = createArticleMetadata({ ...base, seoTitle: "Playbook" });
  const suffixed = createArticleMetadata({ ...base, seoTitle: "Playbook | FSS" });
  assert.deepEqual(plain.title, { absolute: "Playbook | FSS" });
  assert.deepEqual(suffixed.title, { absolute: "Playbook | FSS" });
});
