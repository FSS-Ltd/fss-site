import type { Metadata } from "next";

import { RedesignPage } from "@/components/redesign/design-page";

export const metadata: Metadata = {
  title: "About Faithful Software Solutions | UK Software Studio",
  description:
    "Faithful Software Solutions is a UK studio building dependable custom software, apps and private AI for organisations that need technology they can trust.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About Faithful Software Solutions",
    description:
      "A UK software studio engineering clarity out of complexity with dependable custom software, apps and private AI.",
    url: "/about",
    type: "website",
  },
};

export default function AboutPage() {
  return <RedesignPage name="about" />;
}
