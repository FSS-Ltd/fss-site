import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo/metadata";
import { publicPages } from "@/lib/seo/pages";

import { HomePage } from "@/components/sections/public/home-page";

export const metadata: Metadata = createPageMetadata(publicPages["/"]);

export default function Page() {
  return <HomePage />;
}
