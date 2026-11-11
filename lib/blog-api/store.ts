import readingTime from "reading-time";

import type { GrowthQueryExecutor } from "@/lib/growth/db/types";
import { contentEvidenceSchema } from "@/lib/seo/content";
import type { BlogPost } from "@/lib/types/blog";

import type { BlogPostInput } from "./post-schema";

export type BlogStore = {
  /** Every row with status published, newest first. One query. */
  listPublished(): Promise<BlogPost[]>;
  upsert(input: BlogPostInput): Promise<"created" | "updated">;
};

type Row = {
  slug: string;
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  category: string;
  tags: string[];
  publishDate: string;
  modifiedDate: string;
  author: string;
  coverImage: string;
  seoTitle: string;
  seoDescription: string;
  featured: boolean;
  indexable: boolean;
  evidence: unknown;
};

const evidenceSchema = contentEvidenceSchema
  .omit({ modifiedDate: true, indexable: true })
  .partial();

export function rowToPost(row: Row): BlogPost {
  const evidence = evidenceSchema.safeParse(row.evidence);
  return {
    format: "markdown",
    body: row.bodyMarkdown,
    meta: {
      ...(evidence.success ? evidence.data : {}),
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      publishDate: row.publishDate,
      modifiedDate: row.modifiedDate,
      author: row.author,
      category: row.category,
      tags: row.tags,
      coverImage: row.coverImage,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      featured: row.featured,
      indexable: row.indexable,
      readingMinutes: Math.max(
        1,
        Math.round(readingTime(row.bodyMarkdown).minutes),
      ),
    },
  };
}

export function createBlogStore(db: GrowthQueryExecutor): BlogStore {
  return {
    async listPublished() {
      const rows = await db<Row[]>`
        select
          slug,
          title,
          excerpt,
          body_markdown as "bodyMarkdown",
          category,
          tags,
          to_char(publish_date, 'YYYY-MM-DD') as "publishDate",
          to_char(modified_date, 'YYYY-MM-DD') as "modifiedDate",
          author,
          cover_image as "coverImage",
          seo_title as "seoTitle",
          seo_description as "seoDescription",
          featured,
          indexable,
          evidence
        from growth.blog_posts
        where status = 'published'
        order by publish_date desc
      `;
      return rows.map(rowToPost);
    },

    async upsert(input) {
      const evidence = {
        ...(input.authorUrl ? { authorUrl: input.authorUrl } : {}),
        ...(input.reviewedBy ? { reviewedBy: input.reviewedBy } : {}),
        ...(input.reviewedDate ? { reviewedDate: input.reviewedDate } : {}),
        ...(input.audience ? { audience: input.audience } : {}),
        ...(input.summary ? { summary: input.summary } : {}),
        ...(input.sources ? { sources: input.sources } : {}),
      };
      const modifiedDate = input.modifiedDate ?? input.publishDate;

      const [row] = await db<{ created: boolean }[]>`
        insert into growth.blog_posts (
          slug, title, excerpt, body_markdown, category, tags, primary_keyword,
          status, publish_date, modified_date, author, cover_image, seo_title,
          seo_description, featured, indexable, evidence
        ) values (
          ${input.slug}, ${input.title}, ${input.excerpt}, ${input.bodyMarkdown},
          ${input.category}, ${db.array(input.tags)}::text[], ${input.primaryKeyword},
          ${input.status}, ${input.publishDate}::date, ${modifiedDate}::date,
          ${input.author}, ${input.coverImage}, ${input.seoTitle},
          ${input.seoDescription}, ${input.featured}, ${input.indexable},
          ${JSON.stringify(evidence)}::jsonb
        )
        on conflict (slug) do update set
          title = excluded.title,
          excerpt = excluded.excerpt,
          body_markdown = excluded.body_markdown,
          category = excluded.category,
          tags = excluded.tags,
          primary_keyword = excluded.primary_keyword,
          status = excluded.status,
          publish_date = excluded.publish_date,
          modified_date = excluded.modified_date,
          author = excluded.author,
          cover_image = excluded.cover_image,
          seo_title = excluded.seo_title,
          seo_description = excluded.seo_description,
          featured = excluded.featured,
          indexable = excluded.indexable,
          evidence = excluded.evidence,
          updated_at = now()
        returning (xmax = 0) as created
      `;
      return row?.created ? "created" : "updated";
    },
  };
}
