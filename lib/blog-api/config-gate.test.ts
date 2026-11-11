import assert from "node:assert/strict";
import test from "node:test";

import { getAllBlogPosts, getBlogPostBySlug } from "@/lib/blog";

// CI provisions a Postgres and sets DATABASE_URL, but not the rest of the
// Growth runtime config. That must mean "rows not in use", never "degraded".
test("a bare DATABASE_URL without the Growth runtime config serves files only", async () => {
  const saved = {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    NEXT_PHASE: process.env.NEXT_PHASE,
  };
  try {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:1/unreachable";
    delete process.env.AUTH_SECRET;
    delete process.env.NEXT_PHASE;
    const posts = await getAllBlogPosts();
    assert.ok(posts.length > 0);
    assert.equal(await getBlogPostBySlug("no-such-post-anywhere"), null);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
