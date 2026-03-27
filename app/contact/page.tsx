import type { Metadata } from "next";

import { ContactHero } from "@/components/sections/contact/contact-hero";

export const metadata: Metadata = {
  title: "Contact FSS",
  description:
    "Talk to the FSS team about SDK implementation strategy, rollout planning, and integration support.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact FSS",
    description:
      "Talk to the FSS team about SDK implementation strategy, rollout planning, and integration support.",
    url: "/contact",
    type: "website",
  },
};

export default function ContactPage() {
  return <ContactHero />;
}
