import styles from "@/components/portal/auth/portal.module.css";

export default function PortalAuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <main id="portal-auth-content" className={`${styles.shell} ${styles.main}`}>
      {children}
    </main>
  );
}
