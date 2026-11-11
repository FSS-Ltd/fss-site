import { z } from "zod";

import { blogFrontmatterBaseSchema } from "@/lib/blog";

import { isSafeLinkDestination } from "./links";
import { SLUG_PATTERN } from "./slug";

export const MAX_BODY_CHARS = 60_000;
export const MAX_EVIDENCE_CHARS = 8_000;

const httpUrl = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), "Expected an http(s) URL.");

const shortText = (max: number) => z.string().min(1).max(max);

// Built from the existing frontmatter schema; only API-specific fields are added.
export const blogPostInputSchema = blogFrontmatterBaseSchema
  .extend({
    slug: z
      .string()
      .max(100)
      .regex(SLUG_PATTERN, "Use lowercase letters, digits and hyphens."),
    bodyMarkdown: z.string().min(1).max(MAX_BODY_CHARS),
    // Optional with no default: an update that omits them keeps the stored value.
    status: z.enum(["draft", "published"]).optional(),
    featured: z.boolean().optional(),
    indexable: z.boolean().optional(),
    primaryKeyword: z.string().trim().min(1).max(200),
    title: shortText(300),
    excerpt: shortText(500),
    author: shortText(120),
    category: shortText(80),
    tags: z.array(shortText(50)).min(1).max(10),
    seoTitle: shortText(70),
    seoDescription: shortText(200),
    // Site-relative only: no remote fetches, no protocol-relative or backslash tricks.
    coverImage: z
      .string()
      .min(1)
      .max(300)
      .regex(/^\/(?![/\\])[^\s\\]*$/, "Expected a path under /public, e.g. /images/covers/x.svg."),
    authorUrl: httpUrl.max(2000).optional(),
    reviewedBy: shortText(120).optional(),
    summary: shortText(500).optional(),
    audience: z.array(shortText(100)).max(10).optional(),
    sources: z
      .array(z.object({ title: shortText(200), url: httpUrl.max(2000) }))
      .max(20)
      .optional(),
  })
  .strict()
  .superRefine((post, ctx) => {
    // Keep well below the table's pg_column_size(evidence) <= 20000 check.
    const evidence = JSON.stringify({
      authorUrl: post.authorUrl,
      reviewedBy: post.reviewedBy,
      reviewedDate: post.reviewedDate,
      audience: post.audience,
      summary: post.summary,
      sources: post.sources,
    });
    if (evidence.length > MAX_EVIDENCE_CHARS) {
      ctx.addIssue({ code: "custom", message: "Evidence fields are too large." });
    }
    // Postgres text cannot hold NUL, which would otherwise surface as a 500.
    if (JSON.stringify(post).includes("\\u0000")) {
      ctx.addIssue({ code: "custom", message: "NUL characters are not allowed." });
    }
  });

export type BlogPostInput = z.infer<typeof blogPostInputSchema>;

/**
 * Names the first unsafe construct found, or null. Only fences that start a
 * line count as code, and an unclosed fence hides nothing. Inline code spans
 * are ignored. Rows are also rendered as plain Markdown, so this is a second
 * layer, not the only one.
 */
export function findMdxConstruct(markdown: string): string | null {
  const prose = markdown
    .replace(/^ {0,3}(```|~~~)[^\n]*\n[\s\S]*?^ {0,3}\1[^\n]*$/gm, "")
    .replace(/`[^`\n]*`/g, "");

  if (/^\s*(import|export)\s/m.test(prose)) return "import_or_export";
  if (/<\/?script\b/i.test(prose)) return "script_tag";
  // Plain autolinks are fine; any other raw tag, comment or JSX is not.
  const withoutAutolinks = prose.replace(
    /<(?:(?:https?:\/\/|mailto:)[^\s<>]+|[^\s<>@:]+@[^\s<>]+)>/gi,
    "",
  );
  if (/<[A-Za-z/!?]/.test(withoutAutolinks)) return "tag";
  if (/\{[^{}\n]*\}/.test(prose) || /\{\{/.test(prose)) return "expression";

  const destinations = [
    ...prose.matchAll(/\]\(\s*(<[^>\n]*>|[^\s)]*)/g),
    ...prose.matchAll(/^ {0,3}\[[^\]\n]+\]:\s*(<[^>\n]*>|\S+)/gm),
  ].map((match) => match[1].replace(/^<|>$/g, ""));
  if (destinations.some((dest) => !isSafeLinkDestination(dest))) {
    return "unsafe_link";
  }
  return null;
}
