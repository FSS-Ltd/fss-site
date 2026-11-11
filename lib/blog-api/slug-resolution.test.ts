import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { getAllBlogPostsWith, getBlogPostBySlugWith } from "@/lib/blog";
import type { BlogPost } from "@/lib/types/blog";

import { BlogRowsUnavailableError } from "./rows";

const rowsOf = (posts: BlogPost[]) => async () => ({ posts, degraded: false });

const row: BlogPost = {
  format: "markdown",
  body: "row body",
  meta: {
    slug: "from-row",
    title: "Row",
    excerpt: "E",
    publishDate: "2020-01-01",
    modifiedDate: "2020-01-01",
    author: "A",
    category: "C",
    tags: ["t"],
    coverImage: "/i.svg",
    seoTitle: "S",
    seoDescription: "D",
    featured: false,
    indexable: true,
    readingMinutes: 1,
  },
};

function withDir(run: (dir: string) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blog-slug-"));
  return run(dir).finally(() => fs.rmSync(dir, { recursive: true, force: true }));
}

test("a missing file falls back to a published row", () =>
  withDir(async (dir) => {
    const post = await getBlogPostBySlugWith("from-row", rowsOf([row]), dir);
    assert.equal(post?.body, "row body");
    assert.equal(await getBlogPostBySlugWith("nope", rowsOf([row]), dir), null);
  }));

test("a broken file is not shadowed by a row with the same slug", () =>
  withDir(async (dir) => {
    fs.writeFileSync(path.join(dir, "from-row.mdx"), "---\ntitle: only a title\n---\nbody");
    assert.equal(await getBlogPostBySlugWith("from-row", rowsOf([row]), dir), null);
  }));

test("an unreadable path (a directory named like the post) is not shadowed either", () =>
  withDir(async (dir) => {
    fs.mkdirSync(path.join(dir, "from-row.mdx"));
    assert.equal(await getBlogPostBySlugWith("from-row", rowsOf([row]), dir), null);
  }));

test("slugs that are not strictly slug-shaped never reach the filesystem or the rows", () =>
  withDir(async (dir) => {
    let rowsRead = 0;
    const getRows = async () => {
      rowsRead += 1;
      return { posts: [row], degraded: false };
    };
    for (const slug of ["../package", "a/b", "A-B", "a..b", "a\\b", "", "x".repeat(101), "from-row.mdx"]) {
      assert.equal(await getBlogPostBySlugWith(slug, getRows, dir), null, slug);
    }
    assert.equal(rowsRead, 0);
  }));

const FILE = (title: string, date: string) =>
  `---\ntitle: ${title}\nexcerpt: E\npublishDate: ${date}\nauthor: A\ncategory: C\ntags: [t]\ncoverImage: /i.svg\nseoTitle: S\nseoDescription: D\n---\nbody`;

const rowWith = (slug: string, publishDate: string): BlogPost => ({
  ...row,
  meta: { ...row.meta, slug, publishDate },
});

test("index and post page agree on file ownership, scheduling and rows", () =>
  withDir(async (dir) => {
    fs.writeFileSync(path.join(dir, "past-file.mdx"), FILE("Past", "2020-01-01"));
    fs.writeFileSync(path.join(dir, "future-file.mdx"), FILE("Future", "2999-01-01"));
    fs.writeFileSync(path.join(dir, "both.mdx"), FILE("Both", "2020-01-01"));
    const getRows = rowsOf([
      rowWith("future-file", "2020-01-01"), // owned by the scheduled file: stays hidden
      rowWith("both", "2020-01-01"), // owned by the file: the file wins
      rowWith("row-only", "2020-01-01"),
      rowWith("row-future", "2999-01-01"),
    ]);

    const listed = (await getAllBlogPostsWith(getRows, dir)).map((p) => p.slug);
    const slugs = ["past-file", "future-file", "both", "row-only", "row-future", "ghost"];
    const resolved: string[] = [];
    for (const slug of slugs) {
      if (await getBlogPostBySlugWith(slug, getRows, dir)) resolved.push(slug);
    }

    const sorted = (list: string[]) => [...list].sort();
    assert.deepEqual(
      sorted(listed.filter((slug) => slug !== "church-management-software-vs-bespoke")),
      sorted(resolved),
    );
    assert.deepEqual(sorted(resolved), ["both", "past-file", "row-only"]);
    const both = await getBlogPostBySlugWith("both", getRows, dir);
    assert.equal(both?.format, undefined); // the file's post, not the row
  }));

test("when rows are degraded, row-dependent pages throw instead of returning files-only or 404", () =>
  withDir(async (dir) => {
    fs.writeFileSync(path.join(dir, "past-file.mdx"), FILE("Past", "2020-01-01"));
    const degraded = async () => ({ posts: [], degraded: true });
    const phase = process.env.NEXT_PHASE;
    delete process.env.NEXT_PHASE;
    try {
      await assert.rejects(getAllBlogPostsWith(degraded, dir), BlogRowsUnavailableError);
      await assert.rejects(getBlogPostBySlugWith("missing-slug", degraded, dir), BlogRowsUnavailableError);
      // A file post needs no rows, so it still resolves during an outage.
      assert.ok(await getBlogPostBySlugWith("past-file", degraded, dir));
    } finally {
      if (phase !== undefined) process.env.NEXT_PHASE = phase;
    }
  }));
