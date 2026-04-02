import Link from "next/link";
import type { BlogPostMeta } from "@/lib/types/blog";

import { BlogPostCard } from "@/components/blog/blog-post-card";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

type BlogIndexProps = {
  posts: BlogPostMeta[];
};

export function BlogIndex({ posts }: BlogIndexProps) {
  return (
    <Section>
      <SectionHeading
        eyebrow="Blog"
        title="Insights for product, engineering, and growth teams"
        description="Practical MDX publishing with guidance for product infrastructure teams."
      />
      <p className="mt-4 max-w-2xl text-sm text-text-subtle">
        Looking for implementation assets? Explore{" "}
        <Link href="/resources" className="text-brand-primary hover:underline">
          our resource library
        </Link>
        .
      </p>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {posts.map((post) => (
          <BlogPostCard key={post.slug} post={post} />
        ))}
      </div>
    </Section>
  );
}
