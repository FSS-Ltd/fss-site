import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo/metadata";
import { publicPages } from "@/lib/seo/pages";

import { ResourceLibrary } from "@/components/sections/resources/resource-library";
import { getAllResources } from "@/lib/resources";

export const metadata: Metadata = createPageMetadata(publicPages["/resources"]);

export default async function ResourcesPage() {
  const resources = await getAllResources();

  return <ResourceLibrary resources={resources} />;
}
