import { getAllBlogPosts } from "@/lib/blog";
import { buildRssFeed } from "@/lib/seo/rss";

export const revalidate = 3600;

export async function GET(): Promise<Response> {
  return new Response(buildRssFeed(await getAllBlogPosts()), {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
