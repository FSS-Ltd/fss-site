import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo/metadata";
import { publicPages } from "@/lib/seo/pages";

import { RedesignPage } from "@/components/redesign/design-page";

export const metadata: Metadata = createPageMetadata(publicPages["/contact"]);

export default function ContactPage() {
  return <RedesignPage name="contact" />;
}
