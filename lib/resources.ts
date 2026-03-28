import fs from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import { z } from "zod";

import type { ResourceFrontmatter, ResourceItem, ResourceMeta } from "@/lib/types/resource";

const RESOURCES_CONTENT_DIR = path.join(process.cwd(), "content", "resources");

const resourceDeliverySchema = z
  .object({
    type: z.enum(["direct_download", "internal_asset_page", "external_link", "email_later"]),
    url: z.string().min(1).optional(),
    label: z.string().min(1).optional(),
    notes: z.string().min(1).optional(),
    fileName: z.string().min(1).optional(),
    accessInstructions: z.string().min(1).optional(),
  })
  .superRefine((delivery, ctx) => {
    const requiresUrl =
      delivery.type === "direct_download" ||
      delivery.type === "internal_asset_page" ||
      delivery.type === "external_link";

    if (requiresUrl && !delivery.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "delivery.url is required for this delivery type.",
        path: ["url"],
      });
    }
  });

const resourceFrontmatterSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  shortDescription: z.string().min(1),
  fullDescription: z.string().min(1),
  category: z.string().min(1),
  format: z.string().min(1),
  featured: z.boolean().default(false),
  downloadType: z.string().min(1),
  coverImage: z.string().min(1),
  benefits: z.array(z.string().min(1)).min(1),
  ctaLabel: z.string().min(1),
  thankYouMessage: z.string().min(1),
  seoTitle: z.string().min(1),
  seoDescription: z.string().min(1),
  delivery: resourceDeliverySchema,
});

function parseFrontmatter(frontmatter: unknown): ResourceFrontmatter {
  return resourceFrontmatterSchema.parse(frontmatter);
}

async function getResourceFileNames(): Promise<string[]> {
  const entries = await fs.readdir(RESOURCES_CONTENT_DIR, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
    .map((entry) => entry.name);
}

async function readResourceFile(fileName: string): Promise<string> {
  const fullPath = path.join(RESOURCES_CONTENT_DIR, fileName);
  return fs.readFile(fullPath, "utf8");
}

export async function getAllResources(): Promise<ResourceMeta[]> {
  const fileNames = await getResourceFileNames();

  const resources = await Promise.all(
    fileNames.map(async (fileName) => {
      const source = await readResourceFile(fileName);
      const { data } = matter(source);

      return parseFrontmatter(data);
    }),
  );

  return resources.sort((a, b) => Number(b.featured) - Number(a.featured) || a.title.localeCompare(b.title));
}

export async function getFeaturedResources(): Promise<ResourceMeta[]> {
  const resources = await getAllResources();
  return resources.filter((resource) => resource.featured);
}

export async function getResourceBySlug(slug: string): Promise<ResourceItem | null> {
  const sourcePath = path.join(RESOURCES_CONTENT_DIR, `${slug}.mdx`);

  try {
    const source = await fs.readFile(sourcePath, "utf8");
    const { data, content } = matter(source);
    const frontmatter = parseFrontmatter(data);

    if (frontmatter.slug !== slug) {
      return null;
    }

    return {
      meta: frontmatter,
      body: content,
    };
  } catch {
    return null;
  }
}

export async function getRelatedResources(resource: ResourceMeta, limit = 2): Promise<ResourceMeta[]> {
  const allResources = await getAllResources();

  const related = allResources
    .filter((candidate) => candidate.slug !== resource.slug)
    .filter((candidate) => candidate.category === resource.category)
    .slice(0, limit);

  if (related.length >= limit) {
    return related;
  }

  const fallback = allResources
    .filter((candidate) => candidate.slug !== resource.slug)
    .filter((candidate) => !related.some((item) => item.slug === candidate.slug))
    .slice(0, limit - related.length);

  return [...related, ...fallback];
}
