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
): string | null {
  if (!isPortalHost(hostname) || !isPortalUiPath(pathname)) {
    return null;
  }

  if (pathname === "/") return "/portal";
  if (pathname === "/portal" || pathname.startsWith("/portal/")) return null;

  return `/portal${pathname}`;
}

export function portalRedirectForHost(
  hostname: string,
  pathname: string,
): string | null {
  if (!isPortalHost(hostname)) return null;
  if (pathname === "/portal") return "/";
  if (pathname.startsWith("/portal/")) return pathname.slice("/portal".length);

  return null;
}
