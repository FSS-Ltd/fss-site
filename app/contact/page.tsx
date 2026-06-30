import type { Metadata } from "next";

import { RedesignPage } from "@/components/redesign/design-page";

export const metadata: Metadata = {
  title: "Book a Discovery Call | Custom Software Development UK",
  description:
    "Talk to the Faithful Software Solutions team about your operational software needs. We work with UK charities, schools, churches and businesses to scope and deliver bespoke software.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Book a Discovery Call | Faithful Software Solutions",
    description:
      "Tell us about the operational problem you need to solve. We will outline a practical approach and next steps.",
    url: "/contact",
    type: "website",
  },
};

export default function ContactPage() {
  return <RedesignPage name="contact" />;
}
