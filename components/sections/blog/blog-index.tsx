import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { BlogPostMeta } from "@/lib/types/blog";

import { BlogPostCard } from "@/components/blog/blog-post-card";

type BlogIndexProps = {
  posts: BlogPostMeta[];
};

export function BlogIndex({ posts }: BlogIndexProps) {
  const featuredPost = posts[0];
  const remainingPosts = posts.slice(1);

  return (
    <>
      <section className="relative overflow-hidden bg-[#f2f3f5] px-7 pb-20 pt-[138px]">
        <canvas
          data-hero-canvas
          className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(10,26,46,.026)_1px,transparent_1px),linear-gradient(90deg,rgba(10,26,46,.026)_1px,transparent_1px)] bg-[length:64px_64px] [mask-image:radial-gradient(120%_90%_at_42%_12%,#000,transparent_76%)]" />
        <div
          className="relative mx-auto max-w-[1080px]"
          data-motion-reveal="mask"
        >
          <div className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-[rgba(10,26,46,.12)] bg-white/60 py-1.5 pr-3.5 pl-2.5">
            <span className="h-2 w-2 rounded-full bg-[#14989e] shadow-[0_0_0_4px_rgba(20,152,158,.18)]" />
            <span className="font-mono text-[11px] font-medium tracking-[0.12em] text-[#41506a]">
              FIELD NOTES
            </span>
          </div>
          <h1 className="max-w-[850px] text-[clamp(40px,6vw,78px)] leading-[.99] font-bold text-[#0a1a2e]">
            Software thinking for teams building through complexity.
          </h1>
          <p className="mt-7 max-w-[560px] text-[clamp(16px,1.6vw,20px)] leading-[1.6] text-[#46566c]">
            Practical writing on custom software, operational systems, AI
            workflows, and the engineering choices behind dependable digital
            foundations.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/resources"
              data-magnetic
              className="inline-flex items-center gap-2 rounded-full bg-[#0a1a2e] px-6 py-3.5 text-sm font-semibold text-[#fff] transition hover:bg-[#102642]"
            >
              <span data-mag-label className="inline-flex items-center gap-2">
                Browse resources{" "}
                <ArrowRight className="size-4" aria-hidden="true" />
              </span>
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(10,26,46,.14)] bg-white/70 px-6 py-3.5 text-sm font-semibold text-[#0a1a2e] transition hover:border-[rgba(10,26,46,.28)] hover:bg-white"
            >
              Talk to FSS
            </Link>
          </div>
        </div>
      </section>

      <section
        className="bg-[#f2f3f5] px-7 py-[clamp(80px,10vw,130px)]"
        data-motion-reveal="up"
      >
        <div className="mx-auto max-w-[1180px]">
          {featuredPost ? (
            <div
              data-reveal
              className="mb-14 grid gap-8 lg:grid-cols-[.85fr_1.15fr] lg:items-end"
            >
              <div>
                <p className="font-mono text-xs tracking-[0.14em] text-[#0f7a83]">
                  LATEST ARTICLE
                </p>
                <h2 className="mt-4 max-w-[560px] text-[clamp(28px,4vw,46px)] leading-[1.05] font-semibold text-[#0a1a2e]">
                  Read the latest field note from FSS.
                </h2>
              </div>
              <BlogPostCard post={featuredPost} />
            </div>
          ) : null}

          <div className="grid gap-6 md:grid-cols-2">
            {remainingPosts.map((post) => (
              <BlogPostCard key={post.slug} post={post} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
