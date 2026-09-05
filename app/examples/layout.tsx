import type { Metadata } from "next";
import { resolveSiteUrl } from "@/lib/config/site-url";
import "./examples.css";
import "./roofing.css";
import "./estate.css";
import "./automotive.css";
import "./accountancy.css";
import "./gallery.css";
import "./responsive.css";
import "./cinematic.css";
import "./property-roof-variants.css";
import "@/components/sector-examples/variants/finance-auto.css";
import "./service-guides.css";
import "./booking.css";
import "@/components/sector-examples/collections/trades/index.css";
import "@/components/sector-examples/collections/b2b/index.css";
import "@/components/sector-examples/collections/hospitality-landscape/index.css";

export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteUrl()),
  title: "Example websites | Faithful Software Solutions",
  description:
    "Forty fictional businesses across ten sectors. Distinct websites built around useful content and a clear next step.",
  robots: { index: false, follow: false },
};

export default function ExamplesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
