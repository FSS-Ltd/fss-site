import type { Metadata } from "next";

import { SiteShell } from "@/components/layout/site-shell";
import { AnalyticsLoader } from "@/components/seo/analytics-loader";
import { RootSchema } from "@/components/seo/root-schema";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: "/icon.PNG",
  },
  alternates: {
    canonical: "/",
  },
  robots: {
    index: siteConfig.allowSearchIndexing,
    follow: siteConfig.allowSearchIndexing,
    googleBot: {
      index: siteConfig.allowSearchIndexing,
      follow: siteConfig.allowSearchIndexing,
      "max-snippet": siteConfig.allowSearchIndexing ? -1 : 0,
    },
  },
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.fullName,
    type: "website",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
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
