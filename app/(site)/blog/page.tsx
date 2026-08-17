import type { Metadata } from "next";

import { BlogIndex } from "@/components/sections/blog/blog-index";
import { getAllBlogPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Software Development Insights for UK Businesses, Charities and Schools",
  description:
    "Practical articles on bespoke software strategy, portal development, workflow automation and digital modernisation for UK charities, schools and SMEs.",
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    title: "Software Development Insights | Faithful Software Solutions Blog",
    description:
      "Practical articles on bespoke software strategy, portal development, workflow automation and digital modernisation for UK organisations.",
    url: "/blog",
    type: "website",
  },
};

export default async function BlogPage() {
  const posts = await getAllBlogPosts();

  return <BlogIndex posts={posts} />;
}
