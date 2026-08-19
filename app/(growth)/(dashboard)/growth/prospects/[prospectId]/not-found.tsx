import Link from "next/link";

import styles from "@/components/growth/prospects/prospects.module.css";

export default function ProspectNotFound() {
  return (
    <div className={styles.emptyState}>
      <p>This prospect could not be found. It may have been removed.</p>
      <p>
        <Link className={styles.clearLink} href="/growth/prospects">
          Back to prospects
        </Link>
      </p>
    </div>
  );
}
