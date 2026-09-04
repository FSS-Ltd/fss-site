import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo/metadata";
import { publicPages } from "@/lib/seo/pages";

import { BlogIndex } from "@/components/sections/blog/blog-index";
import { getAllBlogPosts } from "@/lib/blog";
import { RelatedLinks } from "@/components/sections/public/related-links";
import { sectorLink, costLink, comparisonLink } from "@/lib/commercial/links";

export const metadata: Metadata = createPageMetadata(publicPages["/blog"]);

export default async function BlogPage() {
  const posts = await getAllBlogPosts();

  return (
    <>
      <BlogIndex posts={posts} />
      <div className="mx-auto max-w-6xl px-6 pb-16">
        <RelatedLinks links={[sectorLink, costLink, comparisonLink]} />
      </div>
    </>
  );
}
