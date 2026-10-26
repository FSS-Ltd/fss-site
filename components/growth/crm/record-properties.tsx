import Link from "next/link";
import type { CrmRecord } from "@/lib/growth/dashboard/crm-record";
import { AttachContactForm, CreateDealForm } from "./record-capture-actions";
import { CompanyEditor } from "./company-editor";
import { ContactEditor } from "./contact-editor";
import { LeadEditor } from "./lead-editor";
import { OpportunityEditor } from "./opportunity-editor";
import styles from "./crm.module.css";
export function RecordProperties({ record }: { record: CrmRecord }) {
  const { business, contact, engagement } = record;
  const closed = ["won", "lost", "rejected", "suppressed"].includes(
    record.status,
  );
  return (
    <section className={styles.panel} id="record-overview">
      <h2>Record overview</h2>
      <p className={styles.muted}>Company, contact and commercial details.</p>
      <details>
        <summary>Edit company details</summary>
        <CompanyEditor
          key={business.version}
          prospectId={record.prospectId}
          business={business}
        />
      </details>
      {contact && (
        <details>
          <summary>Edit contact details</summary>
          <ContactEditor
            key={contact.version}
            prospectId={record.prospectId}
            contact={contact}
          />
        </details>
      )}
      {!contact && !closed && (
        <AttachContactForm
          prospectId={record.prospectId}
          version={record.prospectVersion}
        />
      )}
      {!engagement && !closed && (
        <CreateDealForm
          prospectId={record.prospectId}
          version={record.prospectVersion}
        />
      )}
      {!closed && (
        <details>
          <summary>Edit lead opportunity</summary>
          <LeadEditor key={record.prospectVersion} record={record} />
        </details>
      )}
      {engagement && (
        <>
          <p className={styles.muted}>
            <Link href={`/growth/deals/${engagement.id}`}>
              Open commercial deal
            </Link>
          </p>
          {!["won", "lost"].includes(engagement.stage) && (
            <details>
              <summary>Edit deal properties</summary>
              <OpportunityEditor
                key={engagement.version}
                prospectId={record.prospectId}
                engagement={engagement}
              />
            </details>
          )}
        </>
      )}
    </section>
  );
}
