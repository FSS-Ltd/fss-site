import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { BlogPostMeta } from "@/lib/types/blog";

import {
  formatEditorialDate,
  groupByCategory,
  latestUpdate,
  selectLeadStory,
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

export function BlogIndex({ posts }: BlogIndexProps) {
  const { lead, rest } = selectLeadStory(posts);
  const secondary = rest.slice(0, SECONDARY_COUNT);
  const contents = rest.slice(SECONDARY_COUNT);
  const sections = groupByCategory(posts);
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
            <span className={styles.nameplateSub}>
              AI and software insights for UK businesses
            </span>
          </h1>
          <div className={styles.mastFoot}>
            <p className={styles.standfirst}>
              Practical writing on AI integration, workflow automation and
              custom software for businesses of any size. What to check
              first, what to build, and what to leave alone.
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
            <span>{plural(sections.length, "section")}</span>
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
            <ul className={styles.railList}>
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
                  <Link href={`/blog/${lead.slug}`} className={cta.link}>
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
                <div
                  className={styles.editionGrid}
                  data-with-contents={contents.length ? "" : undefined}
                >
                  {secondary.map((post) => (
                    <BlogPostCard key={post.slug} post={post} showExcerpt />
                  ))}
                  {contents.length ? (
                    <div>
                      <h3 className={styles.contentsHead}>
                        Also published
                      </h3>
                      <ol className={styles.contents}>
                        {contents.map((post) => (
                          <li key={post.slug}>
                            <Link
                              href={`/blog/${post.slug}`}
                              className={`${cta.link} ${styles.contentsTitle}`}
                            >
                              {post.title}
                            </Link>
                            <PostMeta post={post} />
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            <section
              className={styles.archive}
              aria-labelledby="archive-title"
              data-motion-reveal="up"
            >
              <div className={styles.sectionHead}>
                <h2 id="archive-title" className={styles.archiveTitle}>
                  Every article, by section
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
                  <ul className={styles.archiveList}>
                    {section.posts.map((post) => (
                      <li key={post.slug} className={styles.archiveItem}>
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
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
