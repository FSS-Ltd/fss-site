import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo/metadata";
import { publicPages } from "@/lib/seo/pages";

import { BlogIndex } from "@/components/sections/blog/blog-index";
import { getAllBlogPosts } from "@/lib/blog";
import gutter from "@/components/ui/gutter.module.css";
import { RelatedLinks } from "@/components/sections/public/related-links";
import { sectorLink, costLink } from "@/lib/commercial/links";

export const metadata: Metadata = createPageMetadata(publicPages["/blog"]);

// Scheduled (future-dated) posts appear on their date without a write.
export const revalidate = 3600;

export default async function BlogPage() {
  const posts = await getAllBlogPosts();

  return (
    <>
      <BlogIndex posts={posts} />
      <div className={`pb-16 ${gutter.gutter}`}>
        <RelatedLinks links={[sectorLink, costLink]} />
      </div>
    </>
  );
}
