import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { BlogPostMeta } from "@/lib/types/blog";

import {
  buildEditionMap,
  formatEditorialDate,
  latestUpdate,
} from "@/lib/blog-presentation";
import { EditionMap } from "@/components/blog/edition-map";
import styles from "@/components/blog/blog.module.css";
import cta from "@/components/ui/cta-motion.module.css";
import gutter from "@/components/ui/gutter.module.css";

type BlogIndexProps = {
  posts: BlogPostMeta[];
};

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function BlogIndex({ posts }: BlogIndexProps) {
  const updated = latestUpdate(posts);
  const map = buildEditionMap(posts);

  return (
    <div className={styles.page}>
      <header className={`${styles.masthead} ${gutter.gutter}`}>
        <canvas
          data-hero-canvas
          className={styles.canvas}
          aria-hidden="true"
        />
        <div data-motion-reveal="mask">
          <p className={styles.mastTop}>
            <span>Faithful Software Solutions</span>
            <span>AI, automation and custom software</span>
          </p>
          <h1 className={styles.nameplate}>
            <span className={styles.nameplateWord}>
              Field <em>Notes</em>
            </span>
          </h1>
          <div className={styles.mastFoot}>
            <p className={styles.standfirst}>
              AI and software insights for UK businesses. Practical writing
              on AI integration, workflow automation and custom software for
              businesses of any size: what to check first, what to build, and
              what to leave alone.
            </p>
          </div>
          <div className={styles.dateline}>
            {updated ? (
              <span>
                Index updated&nbsp;
                <time dateTime={updated}>{formatEditorialDate(updated)}</time>
              </span>
            ) : null}
            <span>{plural(posts.length, "article")}</span>
            <Link
              href="/resources"
              data-magnetic
              className={`${styles.datelineLink} ${cta.link}`}
            >
              <span data-mag-label className="inline-flex items-center gap-2">
                Resource library <ArrowRight className="size-4" aria-hidden="true" />
              </span>
            </Link>
          </div>
        </div>
      </header>

      <div className={gutter.gutter}>
        {!map ? (
          <p className={styles.empty}>
            No articles are published yet. The{" "}
            <Link href="/resources" className="underline">
              resource library
            </Link>{" "}
            has practical guides in the meantime.
          </p>
        ) : (
          <EditionMap posts={posts} map={map} />
        )}
      </div>
    </div>
  );
}
