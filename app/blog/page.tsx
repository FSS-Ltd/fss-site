import type { Metadata } from "next";

import { BlogIndex } from "@/components/sections/blog/blog-index";
import { getAllBlogPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "SDK Implementation Blog",
  description:
    "Read practical FSS insights on SDK rollout, technical content strategy, and lead generation execution.",
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    title: "FSS Blog",
    description:
      "Read practical FSS insights on SDK rollout, technical content strategy, and lead generation execution.",
    url: "/blog",
    type: "website",
  },
};

export default async function BlogPage() {
  const posts = await getAllBlogPosts();

  return <BlogIndex posts={posts} />;
}
