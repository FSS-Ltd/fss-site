import fs from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import readingTime from "reading-time";
import { churchArticle } from "@/lib/commercial/church-article";
import { cache } from "react";
import { z } from "zod";

import type { BlogFrontmatter, BlogPost, BlogPostMeta } from "@/lib/types/blog";

import { contentEvidenceSchema, isoDateSchema } from "@/lib/seo/content";
import { SLUG_PATTERN } from "@/lib/blog-api/slug";
import {
  type RowsResult,
  loadRowsSafely,
  requireRows,
  rowsNotOwnedBy,
} from "@/lib/blog-api/rows";
import { createBlogStore } from "@/lib/blog-api/store";
import { getGrowthDb } from "@/lib/growth/db/client";

// A slow database must never stall the blog, sitemap or feed.
const ROW_QUERY_TIMEOUT_MS = 2500;

const BLOG_CONTENT_DIR = path.join(process.cwd(), "content", "blog");

export const blogFrontmatterBaseSchema = contentEvidenceSchema.extend({
  title: z.string().min(1),
  excerpt: z.string().min(1),
  publishDate: isoDateSchema,
  modifiedDate: isoDateSchema.optional(),
  author: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  coverImage: z.string().min(1),
  seoTitle: z.string().min(1),
  seoDescription: z.string().min(1),
  featured: z.boolean().default(false),
});

export const blogFrontmatterSchema = blogFrontmatterBaseSchema.transform(
  (post) => ({
    ...post,
    modifiedDate: post.modifiedDate ?? post.publishDate,
  }),
);

function parseFrontmatter(frontmatter: unknown): BlogFrontmatter {
  return blogFrontmatterSchema.parse(frontmatter);
}

function isPublished(publishDate: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return publishDate <= today;
}

function sortByPublishDateDesc(posts: BlogPostMeta[]): BlogPostMeta[] {
  return [...posts].sort(
    (a, b) =>
      new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime(),
  );
}

function fileNameToSlug(fileName: string): string {
  return fileName.replace(/\.mdx$/, "");
}

function buildPostMeta(
  slug: string,
  body: string,
  frontmatter: BlogFrontmatter,
): BlogPostMeta {
  return {
    ...frontmatter,
    slug,
    readingMinutes: Math.max(1, Math.round(readingTime(body).minutes)),
  };
}

/**
 * Published API rows, one query per request (React cache). Without DATABASE_URL
 * (previews, CI builds) there is nothing to read, so the result is complete.
 * A failure or timeout is reported once and flagged as degraded.
 */
const getPublishedRows = cache(async (): Promise<RowsResult> => {
  if (!process.env.DATABASE_URL) return { posts: [], degraded: false };
  return loadRowsSafely(
    () => createBlogStore(getGrowthDb()).listPublished(),
    ROW_QUERY_TIMEOUT_MS,
    (errorName) =>
      console.error("Blog rows unavailable; not caching a files-only result.", {
        errorName,
      }),
  );
});

export async function getAllBlogPostsWith(
  getRows: () => Promise<RowsResult>,
  contentDir: string = BLOG_CONTENT_DIR,
): Promise<BlogPostMeta[]> {
  const fileNames = (await fs.readdir(contentDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
    .map((entry) => entry.name);

  const posts = await Promise.all(
    fileNames.map(async (fileName) => {
      const source = await fs.readFile(path.join(contentDir, fileName), "utf8");
      const { data, content } = matter(source);
      const frontmatter = parseFrontmatter(data);
      const slug = fileNameToSlug(fileName);

      return buildPostMeta(slug, content, frontmatter);
    }),
  );

  // One rule everywhere: a file owns its slug whatever its date.
  const fileSlugs = new Set([
    ...posts.map((post) => post.slug),
    churchArticle.meta.slug,
  ]);
  const rows = rowsNotOwnedBy(fileSlugs, requireRows(await getRows()))
    .map((post) => post.meta)
    .filter((meta) => isPublished(meta.publishDate));
  const published = posts.filter((post) => isPublished(post.publishDate));

  return sortByPublishDateDesc([...published, churchArticle.meta, ...rows]);
}

export async function getAllBlogPosts(): Promise<BlogPostMeta[]> {
  return getAllBlogPostsWith(getPublishedRows);
}

export async function getFeaturedBlogPosts(): Promise<BlogPostMeta[]> {
  const posts = await getAllBlogPosts();
  return posts.filter((post) => post.featured);
}

export async function getBlogPostBySlugWith(
  slug: string,
  getRows: () => Promise<RowsResult>,
  contentDir: string = BLOG_CONTENT_DIR,
): Promise<BlogPost | null> {
  if (slug === churchArticle.meta.slug) return churchArticle;
  // Nothing outside the strict slug shape may reach path.join.
  if (!SLUG_PATTERN.test(slug) || slug.length > 100) return null;

  let source: string;
  try {
    source = await fs.readFile(path.join(contentDir, `${slug}.mdx`), "utf8");
  } catch (error) {
    // Only a missing file may fall through to a database row; an unreadable
    // file must not be shadowed by one.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") return null;
    const row = requireRows(await getRows()).find(
      (post) => post.meta.slug === slug,
    );
    return row && isPublished(row.meta.publishDate) ? row : null;
  }

  try {
    const { data, content } = matter(source);
    const frontmatter = parseFrontmatter(data);
    if (!isPublished(frontmatter.publishDate)) {
      return null;
    }

    return {
      meta: buildPostMeta(slug, content, frontmatter),
      body: content,
    };
  } catch {
    return null;
  }
}

export async function getBlogPostBySlug(
  slug: string,
): Promise<BlogPost | null> {
  return getBlogPostBySlugWith(slug, getPublishedRows);
}

export async function getRelatedPosts(
  post: BlogPostMeta,
  limit = 2,
): Promise<BlogPostMeta[]> {
  const allPosts = (await getAllBlogPosts()).filter(
    (candidate) =>
      !["sdk-integration-playbook", "technical-content-lead-pipeline"].includes(
        candidate.slug,
      ),
  );

  const related = allPosts
    .filter((candidate) => candidate.slug !== post.slug)
    .filter(
      (candidate) =>
        candidate.category === post.category ||
        candidate.tags.some((tag) => post.tags.includes(tag)),
    )
    .slice(0, limit);

  if (related.length >= limit) {
    return related;
  }

  const fallback = allPosts
    .filter((candidate) => candidate.slug !== post.slug)
    .filter(
      (candidate) => !related.some((item) => item.slug === candidate.slug),
    )
    .slice(0, limit - related.length);

  return [...related, ...fallback];
}
