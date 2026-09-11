import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "FSS Growth OS",
    template: "%s | FSS Growth OS",
  },
  description: "Private founder workspace for FSS Growth OS.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      "max-snippet": 0,
    },
  },
};

export default function GrowthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
