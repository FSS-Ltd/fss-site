import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo/metadata";
import { organisation } from "@/lib/seo/organisation";

import { SiteShell } from "@/components/layout/site-shell";
import { AnalyticsLoader } from "@/components/seo/analytics-loader";
import { RootSchema } from "@/components/seo/root-schema";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  ...createPageMetadata({
    path: "/",
    title: siteConfig.title,
    description: siteConfig.description,
  }),
  metadataBase: new URL(organisation.url),
  icons: { icon: "/icon.PNG" },
  alternates: {
    canonical: organisation.url,
    types: { "application/rss+xml": organisation.url + "/feed.xml" },
  },
};

export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RootSchema />
      <SiteShell>{children}</SiteShell>
      <AnalyticsLoader />
    </>
  );
}
