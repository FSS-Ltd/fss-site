import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";

type PostCover = {
  slug: string;
  coverImageRaw: string;
  coverImagePath: string;
  absoluteCoverPath: string;
  hash: string;
};

const ROOT = process.cwd();
const BLOG_DIR = path.join(ROOT, "content", "blog");
const PUBLIC_DIR = path.join(ROOT, "public");

function stripQueryAndHash(value: string): string {
  return value.split("#")[0]?.split("?")[0] ?? value;
}

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function getBlogFileNames(): Promise<string[]> {
  const entries = await fs.readdir(BLOG_DIR, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
    .map((entry) => entry.name)
    .sort();
}

function fileNameToSlug(fileName: string): string {
  return fileName.replace(/\.mdx$/, "");
}

async function readCoverForPost(fileName: string): Promise<PostCover> {
  const slug = fileNameToSlug(fileName);
  const sourcePath = path.join(BLOG_DIR, fileName);
  const source = await fs.readFile(sourcePath, "utf8");
  const { data } = matter(source);

  const coverImageRaw = String(data.coverImage ?? "").trim();
  if (!coverImageRaw) {
    throw new Error(`[${slug}] missing required frontmatter field: coverImage`);
  }

  const coverImagePath = stripQueryAndHash(coverImageRaw);
  if (!coverImagePath.startsWith("/")) {
    throw new Error(`[${slug}] coverImage must start with '/': ${coverImageRaw}`);
  }

  const absoluteCoverPath = path.join(PUBLIC_DIR, coverImagePath);

  let coverSource: string;
  try {
    coverSource = await fs.readFile(absoluteCoverPath, "utf8");
  } catch {
    throw new Error(`[${slug}] coverImage file not found: ${coverImagePath}`);
  }

  return {
    slug,
    coverImageRaw,
    coverImagePath,
    absoluteCoverPath,
    hash: sha256(coverSource),
  };
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    const key = keyFn(item);
    const existing = grouped.get(key) ?? [];
    existing.push(item);
    grouped.set(key, existing);
  }

  return grouped;
}

function formatDuplicateMessage(title: string, grouped: Map<string, PostCover[]>): string[] {
  const lines: string[] = [];

  for (const [key, posts] of grouped) {
    if (posts.length < 2) {
      continue;
    }

    lines.push(`- ${title}: ${key}`);
    for (const post of posts) {
      lines.push(`  • ${post.slug} (${post.coverImageRaw})`);
    }
  }

  return lines;
}

async function main() {
  const files = await getBlogFileNames();
  const covers = await Promise.all(files.map((fileName) => readCoverForPost(fileName)));

  const byPath = groupBy(covers, (cover) => cover.coverImagePath);
  const byHash = groupBy(covers, (cover) => cover.hash);

  const duplicatePathLines = formatDuplicateMessage("duplicate coverImage path", byPath);
  const duplicateHashLines = formatDuplicateMessage("duplicate image content hash", byHash);

  if (duplicatePathLines.length > 0 || duplicateHashLines.length > 0) {
    console.error("Blog cover validation failed.");

    if (duplicatePathLines.length > 0) {
      console.error("\nRepeated coverImage assignments:");
      console.error(duplicatePathLines.join("\n"));
    }

    if (duplicateHashLines.length > 0) {
      console.error("\nDifferent files with identical image content:");
      console.error(duplicateHashLines.join("\n"));
    }

    process.exit(1);
  }

  console.log(`Validated ${covers.length} blog cover images: all unique by path and content.`);
}

void main();
