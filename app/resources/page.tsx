import type { Metadata } from "next";

import { ResourceLibrary } from "@/components/sections/resources/resource-library";
import { getAllResources } from "@/lib/resources";

export const metadata: Metadata = {
  title: "Resources",
  description: "Lead magnets and implementation resources for evaluation, rollout, and stakeholder alignment.",
  alternates: {
    canonical: "/resources",
  },
};

export default async function ResourcesPage() {
  const resources = await getAllResources();

  return <ResourceLibrary resources={resources} />;
}
