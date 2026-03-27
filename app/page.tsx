import type { Metadata } from "next";

import { HomePage } from "@/components/sections/home/home-page";

export const metadata: Metadata = {
  title: "Product Infrastructure SDK",
  description:
    "FSS helps product and engineering teams ship SDK integrations faster with a maintainable rollout framework.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "FSS Product Infrastructure SDK",
    description:
      "FSS helps product and engineering teams ship SDK integrations faster with a maintainable rollout framework.",
    url: "/",
    type: "website",
  },
};

export default function Page() {
  return <HomePage />;
}
