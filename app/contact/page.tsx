import type { Metadata } from "next";

import { ContactHero } from "@/components/sections/contact/contact-hero";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with FSS to map your SDK integration strategy.",
};

export default function ContactPage() {
  return <ContactHero />;
}
