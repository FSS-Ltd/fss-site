import assert from "node:assert/strict";
import test from "node:test";

import { createBlogHandlers } from "./handler";
import { blogPostInputSchema } from "./post-schema";

const TOKEN = "test-token-not-a-real-secret-0123456789";

const body = {
  slug: "limits",
  title: "T",
  excerpt: "E",
  publishDate: "2026-11-11",
  author: "A",
  category: "C",
  tags: ["t"],
  coverImage: "/i.svg",
  seoTitle: "S",
  seoDescription: "D",
  bodyMarkdown: "ok",
  primaryKeyword: "k",
};

function handlers(onUpsert: (input: unknown) => void = () => {}) {
  return createBlogHandlers({
    token: () => TOKEN,
    store: () => ({
      listPublished: async () => [],
      upsert: async (input) => {
        onUpsert(input);
        return { action: "created", status: "draft" };
      },
    }),
    listPosts: async () => [],
    keywordBank: () => null,
    allowWrite: () => true,
    revalidate: () => {},
    postUrl: (slug) => `https://example.test/blog/${slug}`,
    log: () => {},
  });
}

function post(payload: unknown, headers: Record<string, string> = {}) {
  return new Request("https://example.test/api/blog", {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, ...headers },
    body: JSON.stringify(payload),
  });
}

test("a maximum-size body that JSON-escapes heavily is accepted, not refused", async () => {
  // 60,000 quotes become 120,000 bytes; control characters would be 6 bytes each.
  const response = await handlers().POST(post({ ...body, bodyMarkdown: '"'.repeat(60_000) }));
  assert.equal(response.status, 201);
  const controls = await handlers().POST(post({ ...body, bodyMarkdown: "\u0001".repeat(60_000) }));
  assert.equal(controls.status, 201);
});

test("a declared content-length over the cap is refused without reading the body", async () => {
  let read = false;
  const request = new Request("https://example.test/api/blog", {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-length": "9999999" },
    body: "{}",
  });
  Object.defineProperty(request, "text", {
    value: async () => {
      read = true;
      return "{}";
    },
  });
  assert.equal((await handlers().POST(request)).status, 413);
  assert.equal(read, false);
});

test("input that Postgres would reject is refused by zod first", () => {
  const huge = Array.from({ length: 20 }, () => ({ title: "t".repeat(200), url: `https://example.com/${"p".repeat(1900)}` }));
  assert.equal(blogPostInputSchema.safeParse({ ...body, sources: huge }).success, false);
  assert.equal(blogPostInputSchema.safeParse({ ...body, summary: "s".repeat(500), audience: Array.from({ length: 10 }, () => "a".repeat(100)) }).success, true);
  assert.equal(blogPostInputSchema.safeParse({ ...body, title: "bad\u0000title" }).success, false);
  // Mirrors the migration: tags joined <= 509, seo_title 70, seo_description 200, body 60000.
  const tags = Array.from({ length: 10 }, () => "t".repeat(50));
  assert.equal(blogPostInputSchema.safeParse({ ...body, tags, seoTitle: "s".repeat(70), seoDescription: "d".repeat(200) }).success, true);
  assert.equal(blogPostInputSchema.safeParse({ ...body, bodyMarkdown: "b".repeat(60_001) }).success, false);
});

test("a database check violation is a 422, not a storage outage", async () => {
  const bad = createBlogHandlers({
    token: () => TOKEN,
    store: () => ({
      listPublished: async () => [],
      upsert: async () => {
        throw Object.assign(new Error("new row violates check constraint"), { code: "23514" });
      },
    }),
    listPosts: async () => [],
    keywordBank: () => null,
    allowWrite: () => true,
    revalidate: () => {},
    postUrl: (slug) => slug,
    log: () => {},
  });
  const response = await bad.POST(post(body));
  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), { ok: false, code: "constraint_violation" });
});

test("omitted optional fields stay undefined so an update keeps stored values", async () => {
  let seen: Record<string, unknown> = {};
  await handlers((input) => {
    seen = input as Record<string, unknown>;
  }).POST(post(body));
  for (const key of ["status", "featured", "indexable", "modifiedDate"]) {
    assert.equal(seen[key], undefined, key);
  }
});
