/** Convert an internal portal path into its public portal-subdomain URL. */
export function portalPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error("Expected a portal-relative path.");
  }
  if (path === "/portal") return "/";
  if (path.startsWith("/portal/")) return path.slice(7);
  return path;
}

export function portalUrl(path: string, origin: string): URL {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error("Expected a portal-relative path.");
  }
  const base = new URL(origin);
  if (
    base.protocol !== "https:" &&
    !(base.protocol === "http:" && base.hostname === "localhost")
  ) {
    throw new Error("Expected a secure portal origin.");
  }
  const url = new URL(path, base.origin);
  url.pathname = portalPath(url.pathname);
  return url;
}
