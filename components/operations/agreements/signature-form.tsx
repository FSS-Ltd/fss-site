"use client";
import type { AgreementRecord } from "@/lib/operations/agreements/types";
import { Field, value, emails } from "./form-fields";
import { useAgreementSubmit } from "./use-agreement-submit";
import styles from "./agreements.module.css";
export function SignatureForm({
  organisationId,
  record,
  endpoint,
}: {
  organisationId: string;
  record: AgreementRecord;
  endpoint?: string;
}): React.JSX.Element {
  const state = useAgreementSubmit(organisationId, endpoint);
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void state.submit(() => ({
          action: "sign",
          agreementId: record.id,
          expectedVersion: record.version,
          evidence: {
            confirmed: data.has("evidence.confirmed"),
            sourceHash: value(data, "evidence.sourceHash"),
            signedDocumentHash: value(data, "evidence.signedDocumentHash"),
            documentReference: value(data, "evidence.documentReference"),
            certificateReference:
              value(data, "evidence.certificateReference") || null,
            signatories: emails(data, "evidence.signatories"),
            signedDate: value(data, "evidence.signedDate"),
          },
        }));
      }}
    >
      <fieldset disabled={state.pending}>
        <legend>Record manual signing evidence</legend>
        <p>
          Review revision {record.revision} and its private source document
          before confirming. Signing locks these terms permanently.
        </p>
        <div className={styles.grid}>
          <Field
            issues={state.issues}
            label="Original reviewed source SHA-256"
            name="evidence.sourceHash"
            defaultValue={record.draft.documentHash}
            required
          />
          <Field
            issues={state.issues}
            label="Signed document SHA-256"
            name="evidence.signedDocumentHash"
            required
          />
          <Field
            issues={state.issues}
            label="Private signed document reference"
            name="evidence.documentReference"
            placeholder="private:agreements/signed.pdf"
            required
          />
          <Field
            issues={state.issues}
            label="Private signing certificate reference (optional)"
            name="evidence.certificateReference"
          />
          <Field
            issues={state.issues}
            label="Confirmed signatory emails (comma separated)"
            name="evidence.signatories"
            required
          />
          <Field
            issues={state.issues}
            label="Date all parties completed signing"
            name="evidence.signedDate"
            type="date"
            required
          />
        </div>
        <label>
          <input type="checkbox" name="evidence.confirmed" required /> I
          verified that every required party signed this exact revision.
        </label>
        <button className={styles.primary} type="submit">
          {state.pending ? "Recording…" : "Confirm signed revision"}
        </button>
      </fieldset>
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}
