import { randomUUID } from "node:crypto";
import Link from "next/link";
import { EnquiryList } from "@/components/growth/crm/enquiry-list";
import styles from "@/components/growth/crm/crm.module.css";
import { getGrowthDb } from "@/lib/growth/db/client";
import { getCrmEnquiries } from "@/lib/growth/dashboard/crm-enquiries";
export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const after = typeof params.after === "string" ? params.after : undefined;
  let result: Awaited<ReturnType<typeof getCrmEnquiries>>;
  try {
    result = await getCrmEnquiries(getGrowthDb(), after);
  } catch {
    return (
      <div className={styles.error} role="alert">
        <h1>Enquiries could not load</h1>
        <p>Reference: {randomUUID()}</p>
        <Link href="/growth/prospects/enquiries">Retry</Link>
      </div>
    );
  }
  return <EnquiryList {...result} />;
}
