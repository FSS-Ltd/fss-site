import { format } from "date-fns";

import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { blogPostSummaries } from "@/lib/content/blog";

export function BlogIndex() {
  return (
    <Section>
      <SectionHeading
        eyebrow="Blog"
        title="Insights for product, engineering, and growth teams"
        description="A maintainable content foundation for SEO and thought-leadership publishing."
      />
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {blogPostSummaries.map((post) => (
          <article key={post.slug} className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">
              {format(new Date(post.publishedAt), "MMM d, yyyy")} • {post.readMinutes} min read
            </p>
            <h2 className="mt-3 text-xl font-semibold text-white">{post.title}</h2>
            <p className="mt-3 text-sm text-zinc-400">{post.excerpt}</p>
            <ButtonLink href={`/blog/${post.slug}`} variant="ghost" className="mt-5">
              Read article
            </ButtonLink>
          </article>
        ))}
      </div>
    </Section>
  );
}
