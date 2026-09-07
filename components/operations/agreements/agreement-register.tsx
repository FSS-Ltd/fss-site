import Link from "next/link";
import type {
  AgreementRegister as Register,
  AgreementRecord,
} from "@/lib/operations/agreements/types";
import { totalLinePence } from "@/lib/operations/agreements/validation";
import { penceToGbp } from "@/lib/operations/agreements/money-input";
import { AgreementForm } from "./agreement-form";
import { SignatureForm } from "./signature-form";
import { ActivationForm } from "./activation-form";
import styles from "./agreements.module.css";
function Terms({ record }: { record: AgreementRecord }): React.JSX.Element {
  const d = record.draft;
  return (
    <details>
      <summary>Review revision {record.revision} terms and source</summary>
      <dl className={styles.facts}>
        {Object.entries({
          Scope: d.scope,
          Goals: d.goals,
          Terms: d.terms,
          Support: d.support,
          Responsibilities: d.responsibilities,
          "Tax treatment": d.taxTreatment,
          "Billing contact": d.billingContact,
          Signatories: d.signatories.join(", "),
          "Source hash": d.documentHash,
          "Private source reference": d.documentReference,
          "Notice period": `${d.noticeDays} days`,
          "Minimum term": `${d.minimumTermMonths} months`,
          "Required deposit": `£${penceToGbp(d.requiredDepositPence)}`,
          "Client assets": d.assetsRequired ? "Required" : "Not required",
        }).map(([label, v]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <h3>One-off installments</h3>
      {d.installments.length ? (
        <ul>
          {d.installments.map((i, n) => (
            <li key={n}>
              £{penceToGbp(i.amountPence)} due {i.dueDate}
            </li>
          ))}
        </ul>
      ) : (
        <p>No one-off installments.</p>
      )}
    </details>
  );
}
export function AgreementRegister({
  organisationId,
  register,
}: {
  organisationId: string;
  register: Register;
}): React.JSX.Element {
  return (
    <section className={styles.page} aria-labelledby="agreement-heading">
      <header>
        <Link href="/growth/operations/clients">Back to client register</Link>
        <h1 id="agreement-heading">{register.organisationName}: agreements</h1>
        <p>Signed terms, manual evidence and effective services.</p>
      </header>
      {register.agreements.length === 0 && <p>No agreements on this page.</p>}
      {register.agreements.map((record) => (
        <article className={styles.card} key={`${record.id}-${record.version}`}>
          <h2>{record.draft.title}</h2>
          <p>
            Revision {record.revision} ·{" "}
            {record.status === "signed"
              ? "Signed · manual founder confirmation"
              : "Draft"}
          </p>
          <Terms record={record} />
          {record.draft.lines.map((line, index) => {
            const service = record.services.find(
              (s) => s.lineNumber === index + 1,
            );
            return (
              <section key={index}>
                <h3>{line.description}</h3>
                <p>
                  £{penceToGbp(totalLinePence(line))} including tax{" "}
                  {line.recurrenceMonths === 0
                    ? "one-off"
                    : `every ${line.recurrenceMonths} month${line.recurrenceMonths === 1 ? "" : "s"}`}
                  . Contract: {line.startDate}
                  {line.endDate ? ` to ${line.endDate}` : ", no end date"}.
                </p>
                {service ? (
                  <p>
                    Active from {service.effectiveDate}
                    {service.endDate ? ` until ${service.endDate}` : ""}
                  </p>
                ) : record.status === "signed" ? (
                  <details>
                    <summary>Activate this service</summary>
                    <ActivationForm
                      organisationId={organisationId}
                      record={record}
                      lineNumber={index + 1}
                    />
                  </details>
                ) : (
                  <p>Awaiting signed evidence.</p>
                )}
              </section>
            );
          })}
          {record.evidence ? (
            <details>
              <summary>Signing evidence</summary>
              <p>
                Completed {record.evidence.signedDate} by{" "}
                {record.evidence.signatories.join(", ")}.
              </p>
              <p>
                Private signed document: {record.evidence.documentReference}
              </p>
              <p>
                Signed document SHA-256: {record.evidence.signedDocumentHash}
              </p>
              {record.evidence.certificateReference && (
                <p>Certificate: {record.evidence.certificateReference}</p>
              )}
            </details>
          ) : (
            <>
              <details>
                <summary>Edit draft as a new revision</summary>
                <AgreementForm
                  organisationId={organisationId}
                  engagementIds={register.engagementIds}
                  record={record}
                />
              </details>
              <details>
                <summary>Record signed evidence</summary>
                <SignatureForm
                  organisationId={organisationId}
                  record={record}
                />
              </details>
            </>
          )}
        </article>
      ))}
      {register.nextCursor && (
        <Link
          href={`/growth/operations/clients/${organisationId}/agreements?after=${register.nextCursor}`}
        >
          Next agreement page
        </Link>
      )}
      <details className={styles.card}>
        <summary>Create agreement</summary>
        {register.moreEngagements && (
          <p>
            The first 100 linked engagements are shown. Contact the register
            operator if the required engagement is absent.
          </p>
        )}
        <AgreementForm
          organisationId={organisationId}
          engagementIds={register.engagementIds}
        />
      </details>
    </section>
  );
}
