import type { Metadata } from "next";

import { ServiceSchema } from "@/components/seo/service-schema";
import { ServicesPage } from "@/components/sections/services/services-page";

export const metadata: Metadata = {
  title: "Bespoke Software Development UK | Portals, Dashboards & Workflow Automation",
  description:
    "Custom software development services for UK businesses, charities and schools. We build bespoke ERP systems, client portals, operational dashboards, workflow automation and legacy system migrations.",
  alternates: {
    canonical: "/services",
  },
  openGraph: {
    title: "Bespoke Software Development UK | Faithful Software Solutions",
    description:
      "Custom portals, dashboards, ERP systems and workflow automation for UK organisations that have outgrown off-the-shelf tools.",
    url: "/services",
    type: "website",
  },
};

export default function Page() {
  return (
    <>
      <ServiceSchema />
      <ServicesPage />
    </>
  );
}
