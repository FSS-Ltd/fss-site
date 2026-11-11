import fs from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import readingTime from "reading-time";
import { churchArticle } from "@/lib/commercial/church-article";
import { cache } from "react";
import { z } from "zod";

import type { BlogFrontmatter, BlogPost, BlogPostMeta } from "@/lib/types/blog";

import { contentEvidenceSchema, isoDateSchema } from "@/lib/seo/content";
import { loadRowsSafely, mergeBySlug } from "@/lib/blog-api/rows";
import { createBlogStore } from "@/lib/blog-api/store";
import { getGrowthDb } from "@/lib/growth/db/client";

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

async function getBlogFileNames(): Promise<string[]> {
  const entries = await fs.readdir(BLOG_CONTENT_DIR, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
    .map((entry) => entry.name);
}

async function readBlogFile(fileName: string): Promise<string> {
  const fullPath = path.join(BLOG_CONTENT_DIR, fileName);
  return fs.readFile(fullPath, "utf8");
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
 * (previews, CI builds) there is nothing to read and nothing to report.
 */
const getPublishedRows = cache(async (): Promise<BlogPost[]> => {
  if (!process.env.DATABASE_URL) return [];
  return loadRowsSafely(
    () => createBlogStore(getGrowthDb()).listPublished(),
    (errorName) =>
      console.error("Blog rows unavailable; serving MDX posts only.", {
        errorName,
      }),
  );
});

export async function getAllBlogPosts(): Promise<BlogPostMeta[]> {
  const fileNames = await getBlogFileNames();

  const posts = await Promise.all(
    fileNames.map(async (fileName) => {
      const source = await readBlogFile(fileName);
      const { data, content } = matter(source);
      const frontmatter = parseFrontmatter(data);
      const slug = fileNameToSlug(fileName);

      return buildPostMeta(slug, content, frontmatter);
    }),
  );

  const published = posts.filter((post) => isPublished(post.publishDate));
  const rows = (await getPublishedRows())
    .map((post) => post.meta)
    .filter((meta) => isPublished(meta.publishDate));
  return sortByPublishDateDesc(
    mergeBySlug(
      [...published, churchArticle.meta],
      rows,
      (post) => post.slug,
    ),
  );
}

export async function getFeaturedBlogPosts(): Promise<BlogPostMeta[]> {
  const posts = await getAllBlogPosts();
  return posts.filter((post) => post.featured);
}

export async function getBlogPostBySlug(
  slug: string,
): Promise<BlogPost | null> {
  if (slug === churchArticle.meta.slug) return churchArticle;
  const sourcePath = path.join(BLOG_CONTENT_DIR, `${slug}.mdx`);

  try {
    const source = await fs.readFile(sourcePath, "utf8");
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
    const row = (await getPublishedRows()).find(
      (post) => post.meta.slug === slug,
    );
    return row && isPublished(row.meta.publishDate) ? row : null;
  }
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
