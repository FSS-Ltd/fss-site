import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo/metadata";
import { publicPages } from "@/lib/seo/pages";
import { buildPageSchema } from "@/lib/seo/schema";

import { AboutPage as AboutContent } from "@/components/sections/public/about-page";
import { JsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = createPageMetadata(publicPages["/about"]);

export default function AboutPage() {
  const { path, title, description } = publicPages["/about"];
  return (
    <>
      <JsonLd data={buildPageSchema("AboutPage", path, title, description)} />
      <AboutContent />
    </>
  );
}
