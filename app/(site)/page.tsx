import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo/metadata";
import { publicPages } from "@/lib/seo/pages";

import { RedesignPage } from "@/components/redesign/design-page";

export const metadata: Metadata = createPageMetadata(publicPages["/"]);

export default function Page() {
  return <RedesignPage name="home" />;
}
