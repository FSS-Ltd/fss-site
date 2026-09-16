import Link from "next/link";
import styles from "./studio-shell.module.css";

const navigation = [
  ["Overview", "/admin"],
  ["Clients", "/admin/clients"],
  ["Delivery", "/admin/delivery"],
  ["Agreements", "/admin/agreements"],
  ["Welcome journeys", "/admin/welcome"],
  ["Projects", "/admin/projects"],
  ["Billing", "/admin/billing"],
  ["Notifications", "/admin/notifications"],
  ["Settings", "/admin/settings"],
] as const;

export function StudioShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#studio-content">Skip to content</a>
      <aside className={styles.sidebar} aria-label="FSS Studio">
        <Link className={styles.brand} href="/admin">Faithful Software Solutions</Link>
        <div>
          <p className={styles.label}>FSS Studio</p>
          <nav className={styles.nav} aria-label="FSS Studio modules">
            {navigation.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
          </nav>
        </div>
      </aside>
      <div className={styles.content}>
        <header className={styles.topbar}>
          <p className={styles.topbarTitle}>Founder operations workspace</p>
          <form action="/api/auth/sign-out?returnTo=/login" method="post">
            <button className={styles.signOut} type="submit">Sign out</button>
          </form>
        </header>
        <main className={styles.main} id="studio-content">{children}</main>
      </div>
    </div>
  );
}
