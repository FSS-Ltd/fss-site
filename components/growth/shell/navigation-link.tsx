import Link from "next/link";
import type { ComponentProps, ReactElement } from "react";

type GrowthNavigationLinkProps = Omit<ComponentProps<typeof Link>, "prefetch">;

/**
 * Dashboard routes are dynamic and database-backed. Eagerly prefetching every
 * duplicate desktop, rail, and mobile link can fan one page view out into
 * dozens of concurrent PostgreSQL reads.
 */
export function GrowthNavigationLink(
  props: GrowthNavigationLinkProps,
): ReactElement<ComponentProps<typeof Link>> {
  return <Link {...props} prefetch={false} />;
}
