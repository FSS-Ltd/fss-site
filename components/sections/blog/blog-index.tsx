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
          <article
            key={post.slug}
            className="rounded-2xl border border-border-soft/70 bg-surface-1/78 p-6 shadow-[inset_0_1px_0_rgba(140,180,220,0.08)]"
          >
            <p className="text-xs uppercase tracking-[0.15em] text-text-subtle">
              {format(new Date(post.publishedAt), "MMM d, yyyy")} • {post.readMinutes} min read
            </p>
            <h2 className="mt-3 text-xl font-semibold text-foreground">{post.title}</h2>
            <p className="mt-3 text-sm text-text-muted">{post.excerpt}</p>
            <ButtonLink href={`/blog/${post.slug}`} variant="ghost" className="mt-5">
              Read article
            </ButtonLink>
          </article>
        ))}
      </div>
    </Section>
  );
}
