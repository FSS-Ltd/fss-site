import Link from "next/link";
import type { CrmEnquiry } from "@/lib/growth/dashboard/crm-enquiries";
import { formatGrowthDateTime } from "@/lib/growth/dashboard/formatters";
import styles from "./crm.module.css";
export function EnquiryList({
  rows,
  nextCursor,
}: {
  rows: readonly CrmEnquiry[];
  nextCursor: string | null;
}) {
  return (
    <div className={styles.workspace}>
      <div className={styles.header}>
        <div>
          <h1>Inbound enquiries</h1>
          <p>
            Review requests before creating a lead. Conversion does not start
            outreach.
          </p>
        </div>
        <Link href="/growth/prospects">Back to prospects</Link>
      </div>
      <section className={styles.panel}>
        <h2>Requests</h2>
        {rows.length === 0 ? (
          <p className={styles.empty}>No enquiries to review yet.</p>
        ) : (
          <ul className={styles.items}>
            {rows.map((row) => (
              <li className={styles.item} key={row.id}>
                <div className={styles.header}>
                  <div>
                    <h3>{row.businessName}</h3>
                    <p>
                      {row.firstName} {row.lastName} · {row.email}
                    </p>
                  </div>
                  <span className={styles.tag}>
                    {row.prospectId
                      ? "Converted"
                      : row.submissionType === "site_enquiry"
                        ? "Service enquiry"
                        : "Resource request"}
                  </span>
                </div>
                <time dateTime={row.submittedAt}>
                  {formatGrowthDateTime(row.submittedAt)}
                </time>
                <p>{row.challenge ?? "No challenge supplied."}</p>
                <Link
                  className={styles.linkButton}
                  href={
                    row.prospectId
                      ? `/growth/prospects/${row.prospectId}`
                      : `/growth/prospects/enquiries/${row.id}`
                  }
                >
                  {row.prospectId ? "Open lead" : "Review and convert"}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {nextCursor && (
          <Link
            className={styles.secondary}
            href={`/growth/prospects/enquiries?after=${encodeURIComponent(nextCursor)}`}
          >
            Older enquiries
          </Link>
        )}
      </section>
    </div>
  );
}
