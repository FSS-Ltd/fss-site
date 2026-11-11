import type { BlogPost } from "@/lib/types/blog";

/** MDX files win a slug collision, so an API write can never replace repo content. */
export function mergeBySlug<T>(
  files: readonly T[],
  rows: readonly T[],
  slugOf: (item: T) => string,
): T[] {
  const fileSlugs = new Set(files.map(slugOf));
  return [...files, ...rows.filter((row) => !fileSlugs.has(slugOf(row)))];
}

/**
 * Database trouble must never take the blog down: fall back to files only and
 * report the error name, not the message, which could carry connection details.
 */
export async function loadRowsSafely(
  load: () => Promise<BlogPost[]>,
  report: (errorName: string) => void,
): Promise<BlogPost[]> {
  try {
    return await load();
  } catch (error) {
    report(error instanceof Error ? error.name : "UnknownError");
    return [];
  }
}
