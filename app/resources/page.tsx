import type { Metadata } from "next";

import { ResourceLibrary } from "@/components/sections/resources/resource-library";
import { getAllResources } from "@/lib/resources";

export const metadata: Metadata = {
  title: "Lead Magnets and Resources",
  description:
    "Download conversion-focused FSS resources for SDK planning, rollout readiness, and go-to-market execution.",
  alternates: {
    canonical: "/resources",
  },
  openGraph: {
    title: "FSS Resources",
    description:
      "Download conversion-focused FSS resources for SDK planning, rollout readiness, and go-to-market execution.",
    url: "/resources",
    type: "website",
  },
};

export default async function ResourcesPage() {
  const resources = await getAllResources();

  return <ResourceLibrary resources={resources} />;
}
