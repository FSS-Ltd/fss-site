import readingTime from "reading-time";

import type { GrowthQueryExecutor } from "@/lib/growth/db/types";
import { contentEvidenceSchema } from "@/lib/seo/content";
import type { BlogPost } from "@/lib/types/blog";

import type { BlogPostInput } from "./post-schema";

export type BlogStore = {
  /** Every row with status published, newest first. One query. */
  listPublished(): Promise<BlogPost[]>;
  /**
   * Insert, or update by slug. An update leaves omitted optional fields as they
   * are (status, featured, indexable, evidence keys) and stamps modified_date
   * with today unless one is supplied.
   */
  upsert(input: BlogPostInput): Promise<UpsertResult>;
};

// pg_type oid of text[]; postgres.js needs it to encode arrays without prepared statements.
const TEXT_ARRAY_OID = 1009;

export type UpsertResult = {
  action: "created" | "updated";
  status: "draft" | "published";
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
      const [row] = await db<{ created: boolean; status: "draft" | "published" }[]>`
        insert into growth.blog_posts (
          slug, title, excerpt, body_markdown, category, tags, primary_keyword,
          status, publish_date, modified_date, author, cover_image, seo_title,
          seo_description, featured, indexable, evidence
        ) values (
          ${input.slug}, ${input.title}, ${input.excerpt}, ${input.bodyMarkdown},
          ${input.category}, ${db.array(input.tags, TEXT_ARRAY_OID)}::text[], ${input.primaryKeyword},
          coalesce(${input.status ?? null}::text, 'draft'),
          ${input.publishDate}::date,
          coalesce(${input.modifiedDate ?? null}::date, ${input.publishDate}::date),
          ${input.author}, ${input.coverImage}, ${input.seoTitle},
          ${input.seoDescription},
          coalesce(${input.featured ?? null}::boolean, false),
          coalesce(${input.indexable ?? null}::boolean, true),
          ${db.json(evidence)}
        )
        on conflict (slug) do update set
          title = excluded.title,
          excerpt = excluded.excerpt,
          body_markdown = excluded.body_markdown,
          category = excluded.category,
          tags = excluded.tags,
          primary_keyword = excluded.primary_keyword,
          status = coalesce(${input.status ?? null}::text, growth.blog_posts.status),
          publish_date = excluded.publish_date,
          modified_date = coalesce(${input.modifiedDate ?? null}::date, current_date),
          author = excluded.author,
          cover_image = excluded.cover_image,
          seo_title = excluded.seo_title,
          seo_description = excluded.seo_description,
          featured = coalesce(${input.featured ?? null}::boolean, growth.blog_posts.featured),
          indexable = coalesce(${input.indexable ?? null}::boolean, growth.blog_posts.indexable),
          evidence = growth.blog_posts.evidence || ${db.json(evidence)},
          updated_at = now()
        returning (xmax = 0) as created, status
      `;
      return {
        action: row?.created ? "created" : "updated",
        status: row?.status ?? "draft",
      };
    },
  };
}
