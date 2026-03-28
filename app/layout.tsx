import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";

import { SiteShell } from "@/components/layout/site-shell";
import { RootSchema } from "@/components/seo/root-schema";
import { siteConfig } from "@/lib/site-config";

import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className={`${spaceGrotesk.variable} h-full`}>
      <body className="min-h-full bg-background font-sans text-foreground antialiased">
        <RootSchema />
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
