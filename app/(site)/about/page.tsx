import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo/metadata";
import { publicPages } from "@/lib/seo/pages";

import { AboutPage as AboutContent } from "@/components/sections/public/about-page";

export const metadata: Metadata = createPageMetadata(publicPages["/about"]);

export default function AboutPage() {
  return <AboutContent />;
}
