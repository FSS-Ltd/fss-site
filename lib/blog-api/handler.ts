import { createHash, timingSafeEqual } from "node:crypto";

import type { BlogPostMeta } from "@/lib/types/blog";

import { type KeywordBankEntry, isKnownKeyword } from "./keyword-bank";
import { blogPostInputSchema, findMdxConstruct } from "./post-schema";
import type { BlogStore } from "./store";

const MAX_REQUEST_BYTES = 200_000;
const NO_STORE = { "cache-control": "no-store" } as const;

export type BlogApiDeps = {
  /** Read per request so an unset variable disables writes immediately. */
  token: () => string | undefined;
  store: () => BlogStore;
  listPosts: () => Promise<BlogPostMeta[]>;
  keywordBank: () => readonly KeywordBankEntry[] | null;
  /** Returns false when the caller is over its write budget. */
  allowWrite: (clientKey: string) => boolean;
  revalidate: (slug: string) => void;
  postUrl: (slug: string) => string;
  log: (event: Record<string, string>) => void;
};

function fail(status: number, code: string, extra: object = {}, headers = {}) {
  return Response.json(
    { ok: false, code, ...extra },
    { status, headers: { ...NO_STORE, ...headers } },
  );
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/** Hashing first makes the comparison constant-time regardless of length. */
export function isAuthorised(header: string | null, token: string): boolean {
  const match = /^Bearer (\S+)$/.exec(header ?? "");
  return match ? timingSafeEqual(digest(match[1]), digest(token)) : false;
}

export function clientKeyOf(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

/** Fixed window, per server instance. See docs/runbooks/blog-api.md for the ceiling. */
export function createWriteLimiter(
  limit: number,
  windowMs: number,
  now: () => number = Date.now,
): (key: string) => boolean {
  const windows = new Map<string, { start: number; count: number }>();
  return (key) => {
    const at = now();
    const current = windows.get(key);
    if (!current || at - current.start >= windowMs) {
      if (windows.size > 1000) windows.clear();
      windows.set(key, { start: at, count: 1 });
      return true;
    }
    current.count += 1;
    return current.count <= limit;
  };
}

export function createBlogHandlers(deps: BlogApiDeps) {
  async function GET(): Promise<Response> {
    try {
      const posts = await deps.listPosts();
      return Response.json(
        {
          ok: true,
          posts: posts.map((post) => ({
            slug: post.slug,
            title: post.title,
            excerpt: post.excerpt,
            category: post.category,
            tags: post.tags,
            publishDate: post.publishDate,
            url: deps.postUrl(post.slug),
          })),
        },
        {
          headers: {
            "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
          },
        },
      );
    } catch {
      return fail(500, "list_failed");
    }
  }

  async function POST(request: Request): Promise<Response> {
    const token = deps.token();
    if (!token) return fail(503, "api_disabled");

    // Before auth, so guessing the token is rate-limited too.
    if (!deps.allowWrite(clientKeyOf(request))) {
      return fail(429, "rate_limited", {}, { "retry-after": "60" });
    }

    if (!isAuthorised(request.headers.get("authorization"), token)) {
      return fail(401, "unauthorized", {}, { "www-authenticate": "Bearer" });
    }

    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_REQUEST_BYTES) return fail(413, "body_too_large");
    const raw = await request.text();
    if (raw.length > MAX_REQUEST_BYTES) return fail(413, "body_too_large");

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return fail(400, "invalid_json");
    }

    const parsed = blogPostInputSchema.safeParse(json);
    if (!parsed.success) {
      return fail(400, "invalid_body", {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    const post = parsed.data;

    const construct = findMdxConstruct(post.bodyMarkdown);
    if (construct) return fail(422, "unsupported_markup", { construct });

    if (!isKnownKeyword(deps.keywordBank(), post.primaryKeyword)) {
      return fail(422, "unknown_primary_keyword");
    }

    let action: "created" | "updated";
    try {
      action = await deps.store().upsert(post);
    } catch (error) {
      deps.log({
        event: "blog_api_write_failed",
        slug: post.slug,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      return fail(503, "storage_unavailable");
    }

    deps.log({ event: "blog_api_write", slug: post.slug, action });
    try {
      deps.revalidate(post.slug);
    } catch {
      // The write succeeded; pages refresh on the next revalidation window.
      deps.log({ event: "blog_api_revalidate_failed", slug: post.slug });
    }

    return Response.json(
      {
        ok: true,
        action,
        slug: post.slug,
        status: post.status,
        url: deps.postUrl(post.slug),
      },
      { status: action === "created" ? 201 : 200, headers: NO_STORE },
    );
  }

  return { GET, POST };
}
