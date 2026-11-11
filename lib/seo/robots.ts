import type { MetadataRoute } from "next";
import { organisation } from "./organisation";

const aiCrawlers = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "PerplexityBot",
  "Google-Extended",
];

export function buildRobots(allowIndexing: boolean): MetadataRoute.Robots {
  if (!allowIndexing) return { rules: { userAgent: "*", disallow: "/" } };
  // Let crawlers see noindex on private and confirmation URLs.
  const access = { allow: "/", disallow: "/api/" };
  return {
    rules: [
      { userAgent: "*", ...access },
      ...aiCrawlers.map((userAgent) => ({ userAgent, ...access })),
    ],
    sitemap: `${organisation.url}/sitemap.xml`,
  };
}
