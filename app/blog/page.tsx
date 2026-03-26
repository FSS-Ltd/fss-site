import type { Metadata } from "next";

import { BlogIndex } from "@/components/sections/blog/blog-index";

export const metadata: Metadata = {
  title: "Blog",
  description: "FSS articles on SDK implementation, adoption, and platform scaling.",
};

export default function BlogPage() {
  return <BlogIndex />;
}
