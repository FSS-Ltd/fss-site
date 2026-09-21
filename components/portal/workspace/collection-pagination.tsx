import { PortalActionLink } from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import styles from "./workspace.module.css";

export function CollectionPagination({
  path,
  organisationId,
  page,
  hasNext,
  filter,
}: {
  path: string;
  organisationId: string;
  page: number;
  hasNext: boolean;
  filter?: Readonly<Record<string, string | undefined>>;
}): React.JSX.Element | null {
  if (page === 1 && !hasNext) return null;

  const hrefForPage = (nextPage: number): string => {
    const search = new URLSearchParams({
      organisationId,
      page: String(nextPage),
    });
    for (const [key, value] of Object.entries(filter ?? {})) {
      if (value) search.set(key, value);
    }
    return `${portalPath(path)}?${search.toString()}`;
  };

  return (
    <nav className={styles.pagination} aria-label="Collection pages">
      {page > 1 ? (
        <PortalActionLink href={hrefForPage(page - 1)} variant="secondary">
          Previous page
        </PortalActionLink>
      ) : (
        <span />
      )}
      <span>Page {page}</span>
      {hasNext ? (
        <PortalActionLink href={hrefForPage(page + 1)} variant="secondary">
          Next page
        </PortalActionLink>
      ) : (
        <span />
      )}
    </nav>
  );
}
