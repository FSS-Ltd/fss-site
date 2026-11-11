import { getAllBlogPosts } from "@/lib/blog";
import { getAllResources } from "@/lib/resources";
import { buildLlmsTxt, llmsTxtResponse } from "@/lib/seo/llms";
import { publicPages } from "@/lib/seo/pages";
import { siteConfig } from "@/lib/site-config";

export const revalidate = 3600;

export async function GET(): Promise<Response> {
  // Previews are fully disallowed in robots, so they publish no llms.txt.
  if (!siteConfig.allowSearchIndexing) return llmsTxtResponse(false, () => "");
  const [posts, resources] = await Promise.all([
    getAllBlogPosts(),
    getAllResources(),
  ]);
  return llmsTxtResponse(true, () =>
    buildLlmsTxt(publicPages, posts, resources),
  );
}
