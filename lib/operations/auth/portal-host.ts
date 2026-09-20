import { prefixFreePortalEnabled } from "./release-flags";

const portalHostname = "portal.faithfulsoftware.dev";

const excludedPortalPathPattern =
  /^(?:\/(?:api|webhooks|_next)(?:\/|$)|.*\/[^/]+\.[^/]+$)/;

function isPortalHost(hostname: string): boolean {
  return hostname.toLowerCase() === portalHostname;
}

function isPortalUiPath(pathname: string): boolean {
  return !excludedPortalPathPattern.test(pathname);
}

export function portalRouteForHost(
  hostname: string,
  pathname: string,
  prefixFreeEnabled: boolean = prefixFreePortalEnabled(),
): string | null {
  if (
    !prefixFreeEnabled ||
    !isPortalHost(hostname) ||
    !isPortalUiPath(pathname)
  ) {
    return null;
  }

  if (pathname === "/") return "/portal";
  if (pathname === "/portal" || pathname.startsWith("/portal/")) return null;

  return `/portal${pathname}`;
}

export function portalRedirectForHost(
  hostname: string,
  pathname: string,
  prefixFreeEnabled: boolean = prefixFreePortalEnabled(),
): string | null {
  if (!isPortalHost(hostname) || !isPortalUiPath(pathname)) return null;

  if (prefixFreeEnabled) {
    if (pathname === "/portal") return "/";
    if (pathname.startsWith("/portal/"))
      return pathname.slice("/portal".length);
    return null;
  }

  if (pathname === "/portal" || pathname.startsWith("/portal/")) return null;
  if (pathname === "/") return "/portal";

  return `/portal${pathname}`;
}
