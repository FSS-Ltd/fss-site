import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { getBlogPostBySlugWith } from "@/lib/blog";
import type { BlogPost } from "@/lib/types/blog";

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
    const post = await getBlogPostBySlugWith("from-row", async () => [row], dir);
    assert.equal(post?.body, "row body");
    assert.equal(await getBlogPostBySlugWith("nope", async () => [row], dir), null);
  }));

test("a broken file is not shadowed by a row with the same slug", () =>
  withDir(async (dir) => {
    fs.writeFileSync(path.join(dir, "from-row.mdx"), "---\ntitle: only a title\n---\nbody");
    assert.equal(await getBlogPostBySlugWith("from-row", async () => [row], dir), null);
  }));

test("an unreadable path (a directory named like the post) is not shadowed either", () =>
  withDir(async (dir) => {
    fs.mkdirSync(path.join(dir, "from-row.mdx"));
    assert.equal(await getBlogPostBySlugWith("from-row", async () => [row], dir), null);
  }));

test("slugs that are not strictly slug-shaped never reach the filesystem or the rows", () =>
  withDir(async (dir) => {
    let rowsRead = 0;
    const getRows = async () => {
      rowsRead += 1;
      return [row];
    };
    for (const slug of ["../package", "a/b", "A-B", "a..b", "a\\b", "", "x".repeat(101), "from-row.mdx"]) {
      assert.equal(await getBlogPostBySlugWith(slug, getRows, dir), null, slug);
    }
    assert.equal(rowsRead, 0);
  }));
