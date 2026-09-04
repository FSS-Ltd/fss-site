import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo/metadata";
import { publicPages } from "@/lib/seo/pages";

import { ContactPageContent } from "@/components/sections/public/contact-page";

export const metadata: Metadata = createPageMetadata(publicPages["/contact"]);

export default function ContactPage() {
  return <ContactPageContent />;
}
