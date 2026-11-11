import { revalidatePath } from "next/cache";

import { getAllBlogPosts } from "@/lib/blog";
import {
  createBlogHandlers,
  createWriteLimiter,
} from "@/lib/blog-api/handler";
import { createTtlMemo } from "@/lib/blog-api/rows";
import { readKeywordBank } from "@/lib/blog-api/keyword-bank";
import { createBlogStore } from "@/lib/blog-api/store";
import { getGrowthDb } from "@/lib/growth/db/client";
import { canonicalUrl } from "@/lib/seo/metadata";

// The list is memoised for 5 minutes and ignores query strings, so a cache-busting
// URL never causes extra database work. A write resets it.
const list = createTtlMemo(getAllBlogPosts, 300_000);

const handlers = createBlogHandlers({
  token: () => process.env.BLOG_API_TOKEN?.trim() || undefined,
  store: () => createBlogStore(getGrowthDb()),
  listPosts: list.get,
  keywordBank: () => readKeywordBank(),
  allowWrite: createWriteLimiter(20, 60_000),
  revalidate: (slug) => {
    list.reset();
    for (const path of ["/blog", `/blog/${slug}`, "/sitemap.xml", "/feed.xml"]) {
      revalidatePath(path);
    }
  },
  postUrl: (slug) => canonicalUrl(`/blog/${slug}`),
  log: (event) => console.info("blog-api", event),
});

export const GET = handlers.GET;
export const POST = handlers.POST;
