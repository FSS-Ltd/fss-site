import Link from "next/link";
import styles from "./workspace.module.css";

export function StudioPagination({
  path,
  page,
  hasNext,
  filter,
}: {
  path: string;
  page: number;
  hasNext: boolean;
  filter?: Readonly<Record<string, string | undefined>>;
}): React.JSX.Element | null {
  if (page === 1 && !hasNext) return null;

  const hrefForPage = (nextPage: number): string => {
    const search = new URLSearchParams({ page: String(nextPage) });
    for (const [key, value] of Object.entries(filter ?? {})) {
      if (value) search.set(key, value);
    }
    return `${path}?${search.toString()}`;
  };

  return (
    <nav className={styles.pagination} aria-label="Workspace pages">
      {page > 1 ? (
        <Link href={hrefForPage(page - 1)}>Previous page</Link>
      ) : (
        <span />
      )}
      <span>Page {page}</span>
      {hasNext ? <Link href={hrefForPage(page + 1)}>Next page</Link> : <span />}
    </nav>
  );
}
