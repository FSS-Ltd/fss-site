import { z } from "zod";

import { blogFrontmatterBaseSchema } from "@/lib/blog";

export const MAX_BODY_CHARS = 60_000;

const httpUrl = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), "Expected an http(s) URL.");

// Built from the existing frontmatter schema; only API-specific fields are added.
export const blogPostInputSchema = blogFrontmatterBaseSchema
  .extend({
    slug: z
      .string()
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, digits and hyphens."),
    bodyMarkdown: z.string().min(1).max(MAX_BODY_CHARS),
    status: z.enum(["draft", "published"]).default("draft"),
    primaryKeyword: z.string().trim().min(1).max(200),
    title: z.string().min(1).max(300),
    // Local public assets only: no remote fetches, no javascript: or data: URLs.
    coverImage: z
      .string()
      .min(1)
      .regex(/^\/(?!\/)[^\s]*$/, "Expected a path under /public, e.g. /images/covers/x.svg."),
    authorUrl: httpUrl.optional(),
    sources: z.array(z.object({ title: z.string().min(1), url: httpUrl })).optional(),
  })
  .strict();

export type BlogPostInput = z.infer<typeof blogPostInputSchema>;

/**
 * Names the first MDX/JSX construct found, or null. Code fences and inline code
 * are ignored so tutorials can show imports. Rows are also rendered as plain
 * Markdown, so this is a second layer, not the only one.
 */
export function findMdxConstruct(markdown: string): string | null {
  const prose = markdown
    .replace(/(```|~~~)[\s\S]*?(\1|$)/g, "")
    .replace(/`[^`\n]*`/g, "");

  if (/^\s*(import|export)\s/m.test(prose)) return "import_or_export";
  if (/<\/?script\b/i.test(prose)) return "script_tag";
  // Any raw tag, so JSX components (<Callout />) and HTML are both refused.
  if (/<\/?[A-Za-z][A-Za-z0-9.:-]*(\s[^>]*)?\/?>/.test(prose)) return "tag";
  if (/\{[^{}\n]*\}/.test(prose) || /\{\{/.test(prose)) return "expression";
  return null;
}
