import type { Metadata } from "next";

import { ResourceLibrary } from "@/components/sections/resources/resource-library";

export const metadata: Metadata = {
  title: "Resources",
  description: "Lead magnets and implementation assets for FSS evaluations and rollout planning.",
};

export default function ResourcesPage() {
  return <ResourceLibrary />;
}
