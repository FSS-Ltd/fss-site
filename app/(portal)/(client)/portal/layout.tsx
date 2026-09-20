import Link from "next/link";
import styles from "@/components/portal/auth/portal.module.css";
import { portalPath } from "@/lib/operations/auth/portal-url";

function ClientPortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <div className={styles.shell}>
      <a href="#portal-content" className={styles.skip}>
        Skip to content
      </a>
      <header className={styles.header}>
        <Link href={portalPath("/portal")} className={styles.brand}>
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

export default ClientPortalLayout;
