import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo/metadata";
import { publicPages } from "@/lib/seo/pages";

import { ResourceLibrary } from "@/components/sections/resources/resource-library";
import { getAllResources } from "@/lib/resources";
import { RelatedLinks } from "@/components/sections/public/related-links";
import { sectorLink, costLink, comparisonLink } from "@/lib/commercial/links";

export const metadata: Metadata = createPageMetadata(publicPages["/resources"]);

export default async function ResourcesPage() {
  const resources = await getAllResources();

  return (
    <>
      <ResourceLibrary resources={resources} />
      <div className="mx-auto max-w-6xl px-6 pb-16">
        <RelatedLinks links={[sectorLink, costLink, comparisonLink]} />
      </div>
    </>
  );
}
