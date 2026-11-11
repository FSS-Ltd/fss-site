import assert from "node:assert/strict";
import test from "node:test";

import {
  type BlogApiDeps,
  createBlogHandlers,
  createWriteLimiter,
  isAuthorised,
} from "./handler";
import type { BlogStore } from "./store";

const TOKEN = "test-token-not-a-real-secret-0123456789";

const body = {
  slug: "ai-automation-cost-uk",
  title: "What AI automation costs",
  excerpt: "A plain answer.",
  publishDate: "2026-11-11",
  author: "FSS Growth Team",
  category: "AI",
  tags: ["ai"],
  coverImage: "/images/covers/x.svg",
  seoTitle: "AI automation cost",
  seoDescription: "What it costs.",
  bodyMarkdown: "## Heading\n\nPlain markdown.",
  primaryKeyword: "AI automation cost UK",
};

function setup(overrides: Partial<BlogApiDeps> = {}) {
  const upserts: unknown[] = [];
  const logs: Record<string, string>[] = [];
  const revalidated: string[] = [];
  const store: BlogStore = {
    listPublished: async () => [],
    upsert: async (input) => {
      upserts.push(input);
      return "created";
    },
  };
  const deps: BlogApiDeps = {
    token: () => TOKEN,
    store: () => store,
    listPosts: async () => [],
    keywordBank: () => [{ phrase: "AI automation cost UK", status: "open" }],
    allowWrite: () => true,
    revalidate: (slug) => revalidated.push(slug),
    postUrl: (slug) => `https://example.test/blog/${slug}`,
    log: (event) => logs.push(event),
    ...overrides,
  };
  return { handlers: createBlogHandlers(deps), upserts, logs, revalidated };
}

function post(payload: unknown, headers: Record<string, string> = {}) {
  return new Request("https://example.test/api/blog", {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, ...headers },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

async function code(response: Response) {
  return ((await response.json()) as { code?: string }).code;
}

test("503 and no write when BLOG_API_TOKEN is unset", async () => {
  const { handlers, upserts } = setup({ token: () => undefined });
  const response = await handlers.POST(post(body));
  assert.equal(response.status, 503);
  assert.equal(await code(response), "api_disabled");
  assert.equal(upserts.length, 0);
});

test("401 for a missing, wrong or malformed bearer token", async () => {
  const { handlers, upserts } = setup();
  for (const authorization of [undefined, "Bearer wrong", "Basic abc", TOKEN, `Bearer ${TOKEN} extra`]) {
    const headers: Record<string, string> = authorization ? { authorization } : {};
    const request = new Request("https://example.test/api/blog", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    assert.equal((await handlers.POST(request)).status, 401, String(authorization));
  }
  assert.equal(upserts.length, 0);
});

test("isAuthorised accepts only the exact token", () => {
  assert.equal(isAuthorised(`Bearer ${TOKEN}`, TOKEN), true);
  assert.equal(isAuthorised(`Bearer ${TOKEN}x`, TOKEN), false);
  assert.equal(isAuthorised(null, TOKEN), false);
});

test("429 when over the write budget, before the token is even checked", async () => {
  const { handlers } = setup({ allowWrite: () => false });
  const response = await handlers.POST(post(body, { authorization: "Bearer wrong" }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
});

test("the limiter allows the limit then blocks until the window passes", () => {
  let now = 0;
  const allow = createWriteLimiter(2, 1000, () => now);
  assert.deepEqual([allow("a"), allow("a"), allow("a"), allow("b")], [true, true, false, true]);
  now = 1000;
  assert.equal(allow("a"), true);
});

test("creates a draft by default, logs slug and action only, and revalidates", async () => {
  const { handlers, upserts, logs, revalidated } = setup();
  const response = await handlers.POST(post(body));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    ok: true,
    action: "created",
    slug: body.slug,
    status: "draft",
    url: `https://example.test/blog/${body.slug}`,
  });
  assert.equal((upserts[0] as { status: string }).status, "draft");
  assert.deepEqual(logs, [{ event: "blog_api_write", slug: body.slug, action: "created" }]);
  assert.ok(!JSON.stringify(logs).includes("Plain markdown"));
  assert.deepEqual(revalidated, [body.slug]);
});

test("400 for bad JSON, bad fields and oversize bodies", async () => {
  const { handlers } = setup();
  assert.equal(await code(await handlers.POST(post("{nope"))), "invalid_json");
  const invalid = await handlers.POST(post({ ...body, slug: "Bad Slug" }));
  assert.equal(invalid.status, 400);
  assert.equal(await code(invalid), "invalid_body");
  const big = await handlers.POST(post({ ...body, bodyMarkdown: "x".repeat(250_000) }));
  assert.equal(big.status, 413);
});

test("422 for MDX constructs", async () => {
  const { handlers, upserts } = setup();
  for (const bodyMarkdown of [
    "import x from 'y'\n\nhi",
    "<script>alert(1)</script>",
    "<Callout>hi</Callout>",
    "Value {process.env.SECRET}",
  ]) {
    const response = await handlers.POST(post({ ...body, bodyMarkdown }));
    assert.equal(response.status, 422, bodyMarkdown);
    assert.equal(await code(response), "unsupported_markup");
  }
  assert.equal(upserts.length, 0);
});

test("422 when the keyword is not in the bank, and a missing bank only needs a keyword", async () => {
  const unknown = setup();
  const response = await unknown.handlers.POST(post({ ...body, primaryKeyword: "church software" }));
  assert.equal(response.status, 422);
  assert.equal(await code(response), "unknown_primary_keyword");

  const noBank = setup({ keywordBank: () => null });
  assert.equal((await noBank.handlers.POST(post({ ...body, primaryKeyword: "church software" }))).status, 201);
  assert.equal((await noBank.handlers.POST(post({ ...body, primaryKeyword: " " }))).status, 400);
});

test("a storage failure returns 503 without leaking the error message", async () => {
  const { handlers, logs } = setup({
    store: () => ({
      listPublished: async () => [],
      upsert: async () => {
        throw new Error("password authentication failed for user postgres");
      },
    }),
  });
  const response = await handlers.POST(post(body));
  assert.equal(response.status, 503);
  const text = JSON.stringify(await response.json()) + JSON.stringify(logs);
  assert.ok(!text.includes("password"));
});

test("a revalidation failure does not fail a saved write", async () => {
  const { handlers } = setup({
    revalidate: () => {
      throw new Error("boom");
    },
  });
  assert.equal((await handlers.POST(post(body))).status, 201);
});

test("GET lists the public fields with a shared cache header", async () => {
  const { handlers } = setup({
    listPosts: async () => [
      { slug: "a", title: "A", excerpt: "E", category: "C", tags: ["t"], publishDate: "2026-01-01", author: "x" } as never,
    ],
  });
  const response = await handlers.GET();
  assert.match(response.headers.get("cache-control") ?? "", /s-maxage=300/);
  assert.deepEqual(await response.json(), {
    ok: true,
    posts: [
      { slug: "a", title: "A", excerpt: "E", category: "C", tags: ["t"], publishDate: "2026-01-01", url: "https://example.test/blog/a" },
    ],
  });
});
