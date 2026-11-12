import assert from "node:assert/strict";
import test from "node:test";

import type { BlogPostMeta } from "@/lib/types/blog";
import {
  extractHeadings,
  formatEditorialDate,
  groupByCategory,
  latestUpdate,
  selectLeadStory,
  splitArchive,
  shouldShowContents,
  slugifyHeading,
} from "@/lib/blog-presentation";

function post(overrides: Partial<BlogPostMeta>): BlogPostMeta {
  return {
    slug: "a",
    title: "A",
    excerpt: "e",
    publishDate: "2026-01-01",
    modifiedDate: "2026-01-01",
    author: "FSS",
    category: "Custom Software",
    tags: ["x"],
    coverImage: "/c.svg",
    seoTitle: "s",
    seoDescription: "d",
    featured: false,
    indexable: true,
    readingMinutes: 3,
    ...overrides,
  };
}

test("slugifyHeading makes stable anchor ids", () => {
  assert.equal(
    slugifyHeading("What problem should we document first?"),
    "what-problem-should-we-document-first",
  );
  assert.equal(slugifyHeading("  Café & AI -- costs  "), "cafe-ai-costs");
});

test("extractHeadings reads h2s only, strips inline Markdown and skips code fences", () => {
  const body = [
    "Intro paragraph.",
    "## Start with [one journey](/blog/x)",
    "### Not an h2",
    "```md",
    "## Inside a fence",
    "```",
    "## Use `code` and **bold**",
    "## Closing ##",
  ].join("\n");

  assert.deepEqual(extractHeadings(body), [
    { id: "start-with-one-journey", text: "Start with one journey" },
    { id: "use-code-and-bold", text: "Use code and bold" },
    { id: "closing", text: "Closing" },
  ]);
  assert.deepEqual(extractHeadings("No headings at all."), []);
});

test("contents appear only for three or more sections", () => {
  const two = extractHeadings("## One\n## Two");
  assert.equal(shouldShowContents(two), false);
  assert.equal(shouldShowContents(extractHeadings("## One\n## Two\n## Three")), true);
});

test("selectLeadStory prefers the newest featured post, else the newest", () => {
  const newest = post({ slug: "newest", publishDate: "2026-05-01" });
  const featured = post({ slug: "featured", featured: true, publishDate: "2026-04-01" });
  const older = post({ slug: "older", featured: true, publishDate: "2026-03-01" });

  const picked = selectLeadStory([newest, featured, older]);
  assert.equal(picked.lead?.slug, "featured");
  assert.deepEqual(picked.rest.map((p) => p.slug), ["newest", "older"]);

  assert.equal(selectLeadStory([newest]).lead?.slug, "newest");
  assert.deepEqual(selectLeadStory([newest]).rest, []);
  assert.equal(selectLeadStory([]).lead, undefined);
});

test("groupByCategory keeps newest-first order for sections and posts", () => {
  const groups = groupByCategory([
    post({ slug: "1", category: "Automation" }),
    post({ slug: "2", category: "Custom Software" }),
    post({ slug: "3", category: "Automation" }),
  ]);
  assert.deepEqual(
    groups.map((g) => [g.category, g.id, g.posts.map((p) => p.slug)]),
    [
      ["Automation", "section-automation", ["1", "3"]],
      ["Custom Software", "section-custom-software", ["2"]],
    ],
  );
  assert.deepEqual(groupByCategory([]), []);
});

test("dates render in British form regardless of time zone", () => {
  assert.equal(formatEditorialDate("2026-04-02"), "2 April 2026");
  assert.equal(
    latestUpdate([
      post({ modifiedDate: "2026-04-02" }),
      post({ modifiedDate: "2026-09-04" }),
    ]),
    "2026-09-04",
  );
  assert.equal(latestUpdate([]), undefined);
});

test("splitArchive groups only sections with two or more articles", () => {
  const posts = [
    post({ slug: "a", category: "Automation" }),
    post({ slug: "b", category: "Growth" }),
    post({ slug: "c", category: "Automation" }),
    post({ slug: "d", category: "Software" }),
  ];
  const { groups, ungrouped } = splitArchive(posts);
  assert.deepEqual(groups.map((g) => [g.category, g.posts.map((p) => p.slug)]), [
    ["Automation", ["a", "c"]],
  ]);
  assert.deepEqual(ungrouped.map((p) => p.slug), ["b", "d"]);
});

test("splitArchive yields no groups when every section has one article", () => {
  const { groups, ungrouped } = splitArchive([
    post({ slug: "a", category: "A" }),
    post({ slug: "b", category: "B" }),
  ]);
  assert.equal(groups.length, 0);
  assert.equal(ungrouped.length, 2);
});
