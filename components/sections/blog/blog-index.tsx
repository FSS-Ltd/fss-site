import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { BlogPostMeta } from "@/lib/types/blog";

import {
  formatEditorialDate,
  latestUpdate,
  selectLeadStory,
  splitArchive,
} from "@/lib/blog-presentation";
import { BlogPostCard, PostCover, PostMeta } from "@/components/blog/blog-post-card";
import styles from "@/components/blog/blog.module.css";
import cta from "@/components/ui/cta-motion.module.css";
import gutter from "@/components/ui/gutter.module.css";
import { MeshBand } from "@/components/ui/mesh-band";

type BlogIndexProps = {
  posts: BlogPostMeta[];
};

const SECONDARY_COUNT = 2;

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function ArchiveList({
  posts,
  showCategory = false,
}: {
  posts: BlogPostMeta[];
  showCategory?: boolean;
}) {
  return (
    <ul className={styles.archiveList}>
      {posts.map((post) => (
        <li key={post.slug} className={styles.archiveItem}>
          {showCategory ? <p className={styles.label}>{post.category}</p> : null}
          <Link
            href={`/blog/${post.slug}`}
            className={`${cta.link} ${styles.archiveItemTitle}`}
          >
            {post.title}
          </Link>
          <p>{post.excerpt}</p>
          <PostMeta post={post} />
        </li>
      ))}
    </ul>
  );
}

export function BlogIndex({ posts }: BlogIndexProps) {
  const { lead, rest } = selectLeadStory(posts);
  const secondary = rest.slice(0, SECONDARY_COUNT);
  // Everything not already featured above, so no headline appears twice.
  const { groups: sections, ungrouped } = splitArchive(rest.slice(SECONDARY_COUNT));
  const hasArchive = sections.length > 0 || ungrouped.length > 0;
  const updated = latestUpdate(posts);

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
                Updated&nbsp;
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
        {sections.length > 1 ? (
          <nav aria-label="Sections" className={styles.rail}>
            <ul className={styles.railList} data-scroll-cue>
              {sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>
                    {section.category}
                    <sup aria-label={plural(section.posts.length, "article")}>
                      {section.posts.length}
                    </sup>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <MeshBand section="blog" />
      </header>

      <div className={gutter.gutter}>
        {!lead ? (
          <p className={styles.empty}>
            No articles are published yet. The{" "}
            <Link href="/resources" className="underline">
              resource library
            </Link>{" "}
            has practical guides in the meantime.
          </p>
        ) : (
          <>
            <article
              className={styles.lead}
              aria-labelledby="lead-story"
              data-motion-reveal="up"
            >
              <PostCover post={lead} priority sizes="(min-width: 960px) 680px, 100vw" />
              <div className={styles.leadText}>
                <p className={styles.label}>Lead story / {lead.category}</p>
                <h2 id="lead-story" className={styles.leadTitle}>
                  <Link href={`/blog/${lead.slug}`} className={`${cta.link} ${styles.stretch}`}>
                    {lead.title}
                  </Link>
                </h2>
                <p className={styles.leadStandfirst}>{lead.excerpt}</p>
                <PostMeta post={lead} withAuthor />
              </div>
            </article>

            {secondary.length ? (
              <section
                className={styles.edition}
                aria-labelledby="edition-title"
                data-motion-reveal="up"
              >
                <div className={styles.sectionHead}>
                  <h2 id="edition-title" className={styles.sectionTitle}>
                    Also in this edition
                  </h2>
                </div>
                <div className={styles.editionGrid}>
                  {secondary.map((post) => (
                    <BlogPostCard key={post.slug} post={post} showExcerpt />
                  ))}
                </div>
              </section>
            ) : null}

            {hasArchive ? (
              <section
                className={styles.archive}
                aria-labelledby="archive-title"
                data-motion-reveal="up"
              >
                <div className={styles.sectionHead}>
                  <h2 id="archive-title" className={styles.archiveTitle}>
                    More articles
                  </h2>
                </div>
                {sections.map((section) => (
                  <div key={section.id} id={section.id} className={styles.archiveRow}>
                    <div>
                      <h3 className={styles.archiveSection}>{section.category}</h3>
                      <p className={styles.metaLine}>
                        <span>{plural(section.posts.length, "article")}</span>
                      </p>
                    </div>
                    <ArchiveList posts={section.posts} />
                  </div>
                ))}
                {ungrouped.length ? (
                  <div className={`${styles.archiveRow} ${styles.archiveFlat}`}>
                    <ArchiveList posts={ungrouped} showCategory />
                  </div>
                ) : null}
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
