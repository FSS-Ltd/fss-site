import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { notFound } from "next/navigation";
import { operationsEnabled } from "@/lib/operations/db/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Client portal | Faithful Software Solutions",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function PortalProviderLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  if (!operationsEnabled()) notFound();

  return <ClerkProvider>{children}</ClerkProvider>;
}

export default PortalProviderLayout;
