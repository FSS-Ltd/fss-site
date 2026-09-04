import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo/metadata";
import { publicPages } from "@/lib/seo/pages";

import { BlogIndex } from "@/components/sections/blog/blog-index";
import { getAllBlogPosts } from "@/lib/blog";

export const metadata: Metadata = createPageMetadata(publicPages["/blog"]);

export default async function BlogPage() {
  const posts = await getAllBlogPosts();

  return <BlogIndex posts={posts} />;
}
