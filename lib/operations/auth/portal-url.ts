/** Convert an internal portal path into its visible prefix-free path. */
export function portalPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error("Expected a portal-relative path.");
  }
  if (path === "/portal") return "/";
  if (path.startsWith("/portal/")) return path.slice(7);
  return path;
}
