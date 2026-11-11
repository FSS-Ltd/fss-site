import { revalidatePath } from "next/cache";

import { getAllBlogPosts } from "@/lib/blog";
import {
  createBlogHandlers,
  createWriteLimiter,
} from "@/lib/blog-api/handler";
import { readKeywordBank } from "@/lib/blog-api/keyword-bank";
import { createBlogStore } from "@/lib/blog-api/store";
import { getGrowthDb } from "@/lib/growth/db/client";
import { canonicalUrl } from "@/lib/seo/metadata";

// Reads happen at request time; the CDN header set by GET does the caching.
export const dynamic = "force-dynamic";

const handlers = createBlogHandlers({
  token: () => process.env.BLOG_API_TOKEN?.trim() || undefined,
  store: () => createBlogStore(getGrowthDb()),
  listPosts: getAllBlogPosts,
  keywordBank: () => readKeywordBank(),
  allowWrite: createWriteLimiter(20, 60_000),
  revalidate: (slug) => {
    for (const path of ["/blog", `/blog/${slug}`, "/sitemap.xml", "/feed.xml"]) {
      revalidatePath(path);
    }
  },
  postUrl: (slug) => canonicalUrl(`/blog/${slug}`),
  log: (event) => console.info("blog-api", event),
});

export const GET = handlers.GET;
export const POST = handlers.POST;
