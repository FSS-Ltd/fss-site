import type { Metadata } from "next";

import { ServicesPage } from "@/components/sections/services/services-page";

export const metadata: Metadata = {
  title: "Services | Faithful Software Solutions",
  description:
    "Specialized digital architecture for enterprises, schools, and religious institutions.",
};

export default function Page() {
  return <ServicesPage />;
}
