import { getAllBlogPosts } from "@/lib/blog";
import { getAllResources } from "@/lib/resources";
import { buildLlmsTxt } from "@/lib/seo/llms";
import { publicPages } from "@/lib/seo/pages";

export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const [posts, resources] = await Promise.all([
    getAllBlogPosts(),
    getAllResources(),
  ]);
  return new Response(buildLlmsTxt(publicPages, posts, resources), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
