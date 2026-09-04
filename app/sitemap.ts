import type { MetadataRoute } from "next";
import { getAllBlogPosts } from "@/lib/blog";
import { getAllResources } from "@/lib/resources";
import { canonicalUrl } from "@/lib/seo/metadata";
import { publicPages } from "@/lib/seo/pages";
import type { BlogPostMeta } from "@/lib/types/blog";
import type { ResourceMeta } from "@/lib/types/resource";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, resources] = await Promise.all([
    getAllBlogPosts(),
    getAllResources(),
  ]);
  return buildSitemapEntries(posts, resources);
}

export function buildSitemapEntries(
  posts: BlogPostMeta[],
  resources: ResourceMeta[],
): MetadataRoute.Sitemap {
  const articlePaths = new Set(posts.map((post) => `/blog/${post.slug}`));
  return [
    ...Object.values(publicPages)
      .filter((page) => page.index && !articlePaths.has(page.path))
      .map((page) => ({
        url: canonicalUrl(page.path),
        lastModified: page.modifiedDate,
      })),
    ...posts
      .filter((post) => post.indexable)
      .map((post) => ({
        url: canonicalUrl(`/blog/${post.slug}`),
        lastModified:
          post.modifiedDate > post.publishDate
            ? post.modifiedDate
            : post.publishDate,
      })),
    ...resources
      .filter((resource) => resource.indexable)
      .map((resource) => ({
        url: canonicalUrl(`/resources/${resource.slug}`),
        lastModified: resource.modifiedDate,
      })),
  ];
}
