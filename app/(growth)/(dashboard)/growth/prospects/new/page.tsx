import Link from "next/link";
import { LeadCaptureForm } from "@/components/growth/crm/lead-capture-form";
import styles from "@/components/growth/crm/crm.module.css";
export default function NewLeadPage() {
  return (
    <div className={styles.workspace}>
      <div className={styles.header}>
        <div>
          <h1>New lead</h1>
          <p>Capture the business and the opportunity.</p>
        </div>
        <Link href="/growth/prospects">Back to prospects</Link>
      </div>
      <LeadCaptureForm />
    </div>
  );
}
