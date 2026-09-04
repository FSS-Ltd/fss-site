import type { MetadataRoute } from "next";
import { organisation } from "./organisation";

export function buildRobots(allowIndexing: boolean): MetadataRoute.Robots {
  if (!allowIndexing) return { rules: { userAgent: "*", disallow: "/" } };
  // Let crawlers see noindex on private and confirmation URLs.
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${organisation.url}/sitemap.xml`,
  };
}
