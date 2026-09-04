import type { MetadataRoute } from "next";
import { getAllBlogPosts } from "@/lib/blog";
import { getAllResources } from "@/lib/resources";
import { canonicalUrl } from "@/lib/seo/metadata";
import { publicPages } from "@/lib/seo/pages";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, resources] = await Promise.all([
    getAllBlogPosts(),
    getAllResources(),
  ]);
  return [
    ...Object.values(publicPages)
      .filter((page) => page.index)
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
