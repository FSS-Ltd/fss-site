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
 * Database trouble or slowness must never take the blog down: fall back to files only and
 * report the error name, not the message, which could carry connection details.
 */
export async function loadRowsSafely(
  load: () => Promise<BlogPost[]>,
  timeoutMs: number,
  report: (errorName: string) => void,
): Promise<BlogPost[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      load(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("Blog row query timed out")),
          timeoutMs,
        );
      }),
    ]);
  } catch (error) {
    report(error instanceof Error ? error.name : "UnknownError");
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Caches one async result for ttlMs; `reset` drops it (used after a write). */
export function createTtlMemo<T>(
  load: () => Promise<T>,
  ttlMs: number,
  now: () => number = Date.now,
): { get: () => Promise<T>; reset: () => void } {
  let cached: { at: number; value: Promise<T> } | undefined;
  return {
    get() {
      if (!cached || now() - cached.at >= ttlMs) {
        const value = load();
        cached = { at: now(), value };
        // A failure must not be cached for the whole window.
        value.catch(() => {
          if (cached?.value === value) cached = undefined;
        });
      }
      return cached.value;
    },
    reset() {
      cached = undefined;
    },
  };
}
