import type { Metadata } from "next";

import { RedesignPage } from "@/components/redesign/design-page";

export const metadata: Metadata = {
  title: "Custom Software Development Company UK for Complex Operations",
  description:
    "Faithful Software Solutions builds bespoke software for UK charities, schools, churches and businesses. Custom ERP, portals, dashboards and workflow automation - built around your operational needs, not off-the-shelf limitations.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title:
      "Custom Software Development Company UK | Faithful Software Solutions",
    description:
      "Bespoke software built for real operational problems. Custom ERP, portals, dashboards and workflow automation for UK charities, schools, churches and businesses.",
    url: "/",
    type: "website",
  },
};

export default function Page() {
  return <RedesignPage name="home" />;
}
