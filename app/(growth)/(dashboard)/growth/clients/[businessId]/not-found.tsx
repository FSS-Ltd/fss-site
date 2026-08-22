import Link from "next/link";

import styles from "@/components/growth/clients/clients.module.css";

export default function ClientNotFound() {
  return (
    <div className={styles.emptyState}>
      <p>This client could not be found. It may not have any won engagements yet.</p>
      <p>
        <Link className={styles.clearLink} href="/growth/clients">
          Back to clients
        </Link>
      </p>
    </div>
  );
}
