import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { operationsEnabled } from "@/lib/operations/db/client";
import styles from "@/components/portal/auth/portal.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Client portal | Faithful Software Solutions",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  if (!operationsEnabled()) notFound();
  return (
    <div className={styles.shell}>
      <a href="#portal-content" className={styles.skip}>
        Skip to content
      </a>
      <header className={styles.header}>
        <Link href="/portal" className={styles.brand}>
          Faithful Software Solutions
        </Link>
        <span className={styles.portalLabel}>Client portal</span>
      </header>
      <main id="portal-content" className={styles.main}>
        {children}
      </main>
      <footer className={styles.footer}>
        <span>Built on trust. Delivered with care.</span>
        <span>Faithful Software Solutions</span>
      </footer>
    </div>
  );
}
