import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo/metadata";
import { publicPages } from "@/lib/seo/pages";
import { buildPageSchema } from "@/lib/seo/schema";

import { ContactPageContent } from "@/components/sections/public/contact-page";
import { JsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = createPageMetadata(publicPages["/contact"]);

export default function ContactPage() {
  const { path, title, description } = publicPages["/contact"];
  return (
    <>
      <JsonLd data={buildPageSchema("ContactPage", path, title, description)} />
      <ContactPageContent />
    </>
  );
}
