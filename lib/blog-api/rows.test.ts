import assert from "node:assert/strict";
import test from "node:test";

import { loadRowsSafely, mergeBySlug } from "./rows";
import { createBlogStore, rowToPost } from "./store";
import type { BlogPostInput } from "./post-schema";
import type { GrowthQueryExecutor } from "@/lib/growth/db/types";

test("file posts win a slug collision and rows are appended", () => {
  const merged = mergeBySlug(
    [{ slug: "a", from: "file" }, { slug: "b", from: "file" }],
    [{ slug: "b", from: "row" }, { slug: "c", from: "row" }],
    (item) => item.slug,
  );
  assert.deepEqual(merged, [
    { slug: "a", from: "file" },
    { slug: "b", from: "file" },
    { slug: "c", from: "row" },
  ]);
});

test("a database failure degrades to no rows and reports once without throwing", async () => {
  const reports: string[] = [];
  const rows = await loadRowsSafely(
    async () => {
      throw new TypeError("connect ECONNREFUSED postgres://user:secret@host");
    },
    (name) => reports.push(name),
  );
  assert.deepEqual(rows, []);
  assert.deepEqual(reports, ["TypeError"]);
});

type Call = { sql: string; values: unknown[] };

function fakeDb(result: unknown[]): { db: GrowthQueryExecutor; calls: Call[] } {
  const calls: Call[] = [];
  const tag = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ sql: strings.join("?"), values });
    return result;
  };
  tag.array = (items: unknown[]) => ({ array: items });
  // Unit fake implements only the postgres.js surface the store uses.
  return { db: tag as unknown as GrowthQueryExecutor, calls };
}

const input: BlogPostInput = {
  slug: "s",
  title: "T",
  excerpt: "E",
  publishDate: "2026-11-11",
  modifiedDate: "2026-11-11",
  author: "A",
  category: "C",
  tags: ["x"],
  coverImage: "/i.svg",
  seoTitle: "ST",
  seoDescription: "SD",
  featured: false,
  indexable: true,
  bodyMarkdown: "body'; drop table x; --",
  status: "draft",
  primaryKeyword: "k",
  sources: [{ title: "t", url: "https://example.com" }],
};

test("upsert is one parameterised statement and reports created vs updated", async () => {
  const created = fakeDb([{ created: true }]);
  assert.equal(await createBlogStore(created.db).upsert(input), "created");
  assert.equal(created.calls.length, 1);
  assert.ok(!created.calls[0].sql.includes("drop table"));
  assert.ok(created.calls[0].values.includes(input.bodyMarkdown));
  assert.match(created.calls[0].sql, /on conflict \(slug\) do update/);

  const updated = fakeDb([{ created: false }]);
  assert.equal(await createBlogStore(updated.db).upsert(input), "updated");
});

test("listing published posts is a single query and maps rows to posts", async () => {
  const { db, calls } = fakeDb([
    {
      slug: "s",
      title: "T",
      excerpt: "E",
      bodyMarkdown: "word ".repeat(450),
      category: "C",
      tags: ["x"],
      publishDate: "2026-11-11",
      modifiedDate: "2026-11-11",
      author: "A",
      coverImage: "/i.svg",
      seoTitle: "ST",
      seoDescription: "SD",
      featured: false,
      indexable: true,
      evidence: { sources: [{ title: "t", url: "https://example.com" }], bogus: 1 },
    },
  ]);
  const posts = await createBlogStore(db).listPublished();
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /status = 'published'/);
  assert.equal(posts[0].format, "markdown");
  assert.equal(posts[0].meta.readingMinutes, 2);
  assert.equal(posts[0].meta.sources?.length, 1);
});

test("a corrupt evidence column is ignored rather than breaking the post", () => {
  const post = rowToPost({
    slug: "s", title: "T", excerpt: "E", bodyMarkdown: "b", category: "C",
    tags: ["x"], publishDate: "2026-11-11", modifiedDate: "2026-11-11",
    author: "A", coverImage: "/i.svg", seoTitle: "ST", seoDescription: "SD",
    featured: false, indexable: true, evidence: { authorUrl: 42 },
  });
  assert.equal(post.meta.authorUrl, undefined);
});
