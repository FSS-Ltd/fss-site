import type { Metadata } from "next";

import { BlogIndex } from "@/components/sections/blog/blog-index";
import { getAllBlogPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  description: "MDX articles on SDK implementation, lead generation strategy, and product infrastructure execution.",
  alternates: {
    canonical: "/blog",
  },
};

export default async function BlogPage() {
  const posts = await getAllBlogPosts();

  return <BlogIndex posts={posts} />;
}
