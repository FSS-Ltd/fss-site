import Link from "next/link";

import styles from "@/components/growth/deals/deals.module.css";

export default function DealNotFound() {
  return (
    <div className={styles.emptyState}>
      <p>This deal could not be found. It may have been removed.</p>
      <p>
        <Link className={styles.clearLink} href="/growth/deals">
          Back to deals
        </Link>
      </p>
    </div>
  );
}
