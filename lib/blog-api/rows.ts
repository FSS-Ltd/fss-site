import type { BlogPost } from "@/lib/types/blog";

export type RowsResult = { posts: BlogPost[]; degraded: boolean };

export class BlogRowsUnavailableError extends Error {
  constructor() {
    super("Blog database rows are unavailable");
    this.name = "BlogRowsUnavailableError";
  }
}

/**
 * A slug that exists as an MDX file (parseable, any date) is owned by the file,
 * so a row with that slug is never shown, even while the file is scheduled.
 */
export function rowsNotOwnedBy(
  fileSlugs: ReadonlySet<string>,
  rows: readonly BlogPost[],
): BlogPost[] {
  return rows.filter((row) => !fileSlugs.has(row.meta.slug));
}

/**
 * Pages built from a degraded (files-only) result must not be cached as if they
 * were complete: throw so ISR keeps the last good page. A production build is
 * exempt so an outage cannot block a deploy; revalidation repairs it within the hour.
 */
export function requireRows(result: RowsResult): BlogPost[] {
  if (result.degraded && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new BlogRowsUnavailableError();
  }
  return result.posts;
}

/**
 * Database trouble or slowness must never take the blog down silently: report the
 * error name (not the message, which could carry connection details) and flag the
 * result as degraded. A timed-out query keeps its pool connection until it finishes.
 */
export async function loadRowsSafely(
  load: () => Promise<BlogPost[]>,
  timeoutMs: number,
  report: (errorName: string) => void,
): Promise<RowsResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const posts = await Promise.race([
      load(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("Blog row query timed out")),
          timeoutMs,
        );
      }),
    ]);
    return { posts, degraded: false };
  } catch (error) {
    report(error instanceof Error ? error.name : "UnknownError");
    return { posts: [], degraded: true };
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
