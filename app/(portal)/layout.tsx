import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { portalFont } from "@/components/portal/portal-font";
import styles from "@/components/portal/portal-theme.module.css";
import { operationsEnabled } from "@/lib/operations/db/client";
import {
  isPortalAppearance,
  PORTAL_APPEARANCE_COOKIE,
} from "@/lib/operations/design/portal-appearance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Client portal | Faithful Software Solutions",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

async function PortalProviderLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  const appearanceCookie = (await cookies()).get(
    PORTAL_APPEARANCE_COOKIE,
  )?.value;
  const appearance = isPortalAppearance(appearanceCookie)
    ? appearanceCookie
    : "system";

  return (
    <ClerkProvider>
      <div
        className={`${portalFont.variable} ${styles.theme} portal-theme`}
        data-appearance={appearance}
      >
        {children}
      </div>
    </ClerkProvider>
  );
}

export default PortalProviderLayout;
