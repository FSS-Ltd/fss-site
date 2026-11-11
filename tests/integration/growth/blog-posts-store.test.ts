import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import postgres from "postgres";

import type { BlogPostInput } from "../../../lib/blog-api/post-schema";
import { createBlogStore } from "../../../lib/blog-api/store";

const connectionString = process.env.DIRECT_DATABASE_URL;

function postInput(slug: string, overrides: Partial<BlogPostInput> = {}): BlogPostInput {
  return {
    slug,
    title: "Store integration post",
    excerpt: "Excerpt",
    publishDate: "2026-01-02",
    author: "Integration",
    category: "Testing",
    tags: ["alpha", "beta"],
    coverImage: "/images/covers/x.svg",
    seoTitle: "SEO title",
    seoDescription: "SEO description",
    bodyMarkdown: "Body with 'quotes' and \"doubles\"; drop table x;",
    primaryKeyword: "integration keyword",
    sources: [{ title: "Source", url: "https://example.com/a" }],
    ...overrides,
  };
}

test(
  "blog store round-trips posts through real Postgres with the migration constraints",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;
    // Same options as the runtime client (transaction pooler: no prepared statements).
    const sql = postgres(connectionString, { max: 2, prepare: false });
    const store = createBlogStore(sql);
    const prefix = `it-${randomUUID().slice(0, 8)}`;
    const slug = `${prefix}-main`;

    try {
      // Insert: created, defaults applied, tags stored as an array.
      const created = await store.upsert(postInput(slug));
      assert.deepEqual(created, { action: "created", status: "draft" });
      const [row] = await sql<
        { tags: string[]; evidence: unknown; evidenceType: string; modified: string; featured: boolean; indexable: boolean; body: string }[]
      >`
        select tags, evidence, jsonb_typeof(evidence) as "evidenceType",
          to_char(modified_date, 'YYYY-MM-DD') as modified, featured, indexable,
          body_markdown as body
        from growth.blog_posts where slug = ${slug}
      `;
      assert.deepEqual(row.tags, ["alpha", "beta"]);
      // An object, not a JSON string (the double-encoding bug).
      assert.equal(row.evidenceType, "object");
      assert.deepEqual(row.evidence, { sources: [{ title: "Source", url: "https://example.com/a" }] });
      assert.equal(row.modified, "2026-01-02");
      assert.equal(row.featured, false);
      assert.equal(row.indexable, true);
      assert.ok(row.body.includes("drop table x"));

      // Drafts are not listed; publishing makes it visible.
      assert.equal((await store.listPublished()).some((p) => p.meta.slug === slug), false);
      assert.deepEqual(
        await store.upsert(postInput(slug, { status: "published", featured: true, indexable: false })),
        { action: "updated", status: "published" },
      );
      const listed = (await store.listPublished()).find((p) => p.meta.slug === slug);
      assert.ok(listed);
      assert.equal(listed.meta.featured, true);
      assert.equal(listed.meta.indexable, false);
      assert.deepEqual(listed.meta.sources, [{ title: "Source", url: "https://example.com/a" }]);

      // A partial update keeps stored optional values, merges evidence, stamps today.
      const update = await store.upsert(
        postInput(slug, { title: "Renamed", summary: "New summary", sources: undefined }),
      );
      assert.deepEqual(update, { action: "updated", status: "published" });
      const [after] = await sql<
        { title: string; featured: boolean; indexable: boolean; evidence: Record<string, unknown>; modifiedIsToday: boolean }[]
      >`
        select title, featured, indexable, evidence, modified_date = current_date as "modifiedIsToday"
        from growth.blog_posts where slug = ${slug}
      `;
      assert.equal(after.title, "Renamed");
      assert.equal(after.featured, true);
      assert.equal(after.indexable, false);
      assert.deepEqual(after.evidence, {
        sources: [{ title: "Source", url: "https://example.com/a" }],
        summary: "New summary",
      });
      assert.equal(after.modifiedIsToday, true);

      // An explicit modifiedDate is honoured.
      await store.upsert(postInput(slug, { modifiedDate: "2026-03-04" }));
      const [explicit] = await sql<{ modified: string }[]>`
        select to_char(modified_date, 'YYYY-MM-DD') as modified from growth.blog_posts where slug = ${slug}
      `;
      assert.equal(explicit.modified, "2026-03-04");

      // Constraint violations (input that bypassed zod) are check violations, not crashes.
      for (const bad of [
        postInput(`${prefix}-tags`, { tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }),
        postInput(`${prefix}-seo`, { seoTitle: "s".repeat(71) }),
        postInput(`${prefix}-body`, { bodyMarkdown: "b".repeat(60_001) }),
      ]) {
        await assert.rejects(store.upsert(bad), (error: { code?: string }) => error.code === "23514");
      }
    } finally {
      await sql`delete from growth.blog_posts where slug like ${`${prefix}-%`}`;
      await sql.end();
    }
  },
);
