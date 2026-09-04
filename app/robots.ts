import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";
import { buildRobots } from "@/lib/seo/robots";

export default function robots(): MetadataRoute.Robots {
  return buildRobots(siteConfig.allowSearchIndexing);
}
