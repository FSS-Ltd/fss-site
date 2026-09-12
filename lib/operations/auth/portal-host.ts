const portalHostname = "portal.faithfulsoftware.dev";

export function portalRouteForHost(
  hostname: string,
  pathname: string,
): string | null {
  if (hostname.toLowerCase() !== portalHostname || pathname !== "/") {
    return null;
  }
  return "/portal";
}
