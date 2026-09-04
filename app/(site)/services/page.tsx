import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo/metadata";
import { publicPages } from "@/lib/seo/pages";

import { ServicesPage } from "@/components/sections/public/services-page";
import { ServiceSchema } from "@/components/seo/service-schema";

export const metadata: Metadata = createPageMetadata(publicPages["/services"]);

export default function Page() {
  return (
    <>
      <ServiceSchema />
      <ServicesPage />
    </>
  );
}
