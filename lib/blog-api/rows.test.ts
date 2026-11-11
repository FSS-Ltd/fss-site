import assert from "node:assert/strict";
import test from "node:test";

import {
  BlogRowsUnavailableError,
  createTtlMemo,
  loadRowsSafely,
  requireRows,
  rowsNotOwnedBy,
} from "./rows";
import { createBlogStore, rowToPost } from "./store";
import type { BlogPostInput } from "./post-schema";
import type { GrowthQueryExecutor } from "@/lib/growth/db/types";

test("a slug owned by a file hides a row with the same slug", () => {
  const row = (slug: string) => ({ meta: { slug } }) as never;
  const kept = rowsNotOwnedBy(new Set(["a", "future-file"]), [row("a"), row("future-file"), row("c")]);
  assert.deepEqual(kept.map((r) => r.meta.slug), ["c"]);
});

test("a degraded result throws outside a build and passes inside one", () => {
  const degraded = { posts: [], degraded: true };
  const phase = process.env.NEXT_PHASE;
  try {
    delete process.env.NEXT_PHASE;
    assert.throws(() => requireRows(degraded), BlogRowsUnavailableError);
    assert.deepEqual(requireRows({ posts: [], degraded: false }), []);
    process.env.NEXT_PHASE = "phase-production-build";
    assert.deepEqual(requireRows(degraded), []);
  } finally {
    if (phase === undefined) delete process.env.NEXT_PHASE;
    else process.env.NEXT_PHASE = phase;
  }
});

test("a database failure degrades to no rows and reports once without throwing", async () => {
  const reports: string[] = [];
  const rows = await loadRowsSafely(
    async () => {
      throw new TypeError("connect ECONNREFUSED postgres://user:secret@host");
    },
    1000,
    (name) => reports.push(name),
  );
  assert.deepEqual(rows, { posts: [], degraded: true });
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
  tag.json = (value: unknown) => ({ json: value });
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
  const created = fakeDb([{ created: true, status: "draft" }]);
  assert.deepEqual(await createBlogStore(created.db).upsert(input), { action: "created", status: "draft" });
  // Evidence goes through db.json (not a pre-stringified string that would double-encode).
  assert.deepEqual(created.calls[0].values.filter((v) => typeof v === "object" && v !== null && "json" in v), [{ json: { sources: input.sources } }, { json: { sources: input.sources } }]);
  assert.equal(created.calls.length, 1);
  assert.ok(!created.calls[0].sql.includes("drop table"));
  assert.ok(created.calls[0].values.includes(input.bodyMarkdown));
  assert.match(created.calls[0].sql, /on conflict \(slug\) do update/);

  const updated = fakeDb([{ created: false, status: "published" }]);
  assert.deepEqual(await createBlogStore(updated.db).upsert(input), { action: "updated", status: "published" });
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

test("a query slower than the timeout degrades to no rows and reports once", async () => {
  const reports: string[] = [];
  const rows = await loadRowsSafely(
    () => new Promise(() => {}),
    20,
    (name) => reports.push(name),
  );
  assert.deepEqual(rows, { posts: [], degraded: true });
  assert.deepEqual(reports, ["Error"]);
});

test("the TTL memo loads once per window, reloads after expiry or reset, and drops failures", async () => {
  let now = 0;
  let loads = 0;
  const memo = createTtlMemo(async () => ++loads, 300, () => now);
  assert.deepEqual([await memo.get(), await memo.get()], [1, 1]);
  now = 300;
  assert.equal(await memo.get(), 2);
  memo.reset();
  assert.equal(await memo.get(), 3);

  let fail = true;
  const flaky = createTtlMemo(async () => {
    if (fail) throw new Error("x");
    return "ok";
  }, 300, () => now);
  await assert.rejects(flaky.get());
  fail = false;
  assert.equal(await flaky.get(), "ok");
});
