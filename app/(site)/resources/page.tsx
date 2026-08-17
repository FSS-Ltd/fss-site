import type { Metadata } from "next";

import { ResourceLibrary } from "@/components/sections/resources/resource-library";
import { getAllResources } from "@/lib/resources";

export const metadata: Metadata = {
  title: "Free Software Strategy Guides for UK Charities, Schools and Businesses",
  description:
    "Download free practical guides on custom software planning, portal development and digital modernisation. Built for UK charity leaders, school administrators and business owners.",
  alternates: {
    canonical: "/resources",
  },
  openGraph: {
    title: "Free Software Strategy Guides | Faithful Software Solutions",
    description:
      "Practical guides on custom software planning, portal development and digital modernisation for UK charities, schools and businesses.",
    url: "/resources",
    type: "website",
  },
};

export default async function ResourcesPage() {
  const resources = await getAllResources();

  return <ResourceLibrary resources={resources} />;
}
