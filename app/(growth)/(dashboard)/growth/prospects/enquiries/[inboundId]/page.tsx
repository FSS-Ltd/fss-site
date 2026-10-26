import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadCaptureForm } from "@/components/growth/crm/lead-capture-form";
import styles from "@/components/growth/crm/crm.module.css";
import { getGrowthDb } from "@/lib/growth/db/client";
import { getCrmEnquiry } from "@/lib/growth/dashboard/crm-enquiries";
export default async function EnquiryPage({
  params,
}: {
  params: Promise<{ inboundId: string }>;
}) {
  const { inboundId } = await params;
  const enquiry = await getCrmEnquiry(getGrowthDb(), inboundId);
  if (!enquiry) notFound();
  return (
    <div className={styles.workspace}>
      <div className={styles.header}>
        <h1>Review enquiry</h1>
        <Link href="/growth/prospects/enquiries">All enquiries</Link>
      </div>
      {enquiry.prospectId ? (
        <section className={styles.panel}>
          <h2>Lead already created</h2>
          <Link href={`/growth/prospects/${enquiry.prospectId}`}>
            Open lead
          </Link>
        </section>
      ) : (
        <>
          <section className={styles.panel}>
            <h2>{enquiry.businessName}</h2>
            <p>
              {enquiry.firstName} {enquiry.lastName} · {enquiry.email}
            </p>
            <p>{enquiry.challenge ?? "No challenge supplied."}</p>
            <p className={styles.muted}>
              Source: {enquiry.sourcePath}. Verify corporate identity and
              contact provenance before conversion.
            </p>
          </section>
          <LeadCaptureForm enquiry={enquiry} />
        </>
      )}
    </div>
  );
}
