"use client";

import { type FormEvent } from "react";
import {
  Notice,
  PortalButton,
  PortalCard,
  PortalCheckbox,
  PortalField,
} from "@/components/portal/ui";
import { emails, value } from "@/components/operations/agreements/form-fields";
import { useAgreementSubmit } from "@/components/operations/agreements/use-agreement-submit";
import type { AgreementDraft } from "@/lib/operations/agreements/types";
import styles from "./agreements.module.css";

type SignatureEvidenceRecord = Readonly<{
  id: string;
  revision: number;
  version: number;
  draft: Pick<AgreementDraft, "documentHash" | "signatories">;
}>;

export function SignatureEvidenceForm({
  endpoint,
  organisationId,
  record,
}: Readonly<{
  endpoint?: string;
  organisationId: string;
  record: SignatureEvidenceRecord;
}>): React.JSX.Element {
  const state = useAgreementSubmit(organisationId, endpoint);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void state.submit(() => ({
      action: "sign",
      agreementId: record.id,
      expectedVersion: record.version,
      evidence: {
        certificateReference:
          value(data, "evidence.certificateReference") || null,
        confirmed: data.has("evidence.confirmed"),
        documentReference: value(data, "evidence.documentReference"),
        signedDate: value(data, "evidence.signedDate"),
        signedDocumentHash: value(data, "evidence.signedDocumentHash"),
        signatories: emails(data, "evidence.signatories"),
        sourceHash: value(data, "evidence.sourceHash"),
      },
    }));
  }

  return (
    <form aria-busy={state.pending} className={styles.detail} onSubmit={submit}>
      <Notice tone="warning">
        <strong>Manual review is distinct from provider verification.</strong>
        <p>
          Fingerprints are checked server-side against this exact source and
          retained signed document. This route records reviewed evidence; it
          does not claim a provider-verified signature.
        </p>
      </Notice>
      <PortalCard
        title={`Record signed evidence · revision ${record.revision}`}
      >
        <PortalField
          hint="Prefilled from the reviewed source retained with this revision."
          label="Original reviewed source SHA-256"
          required
        >
          <input
            defaultValue={record.draft.documentHash}
            name="evidence.sourceHash"
          />
        </PortalField>
        <PortalField label="Signed document SHA-256" required>
          <input name="evidence.signedDocumentHash" />
        </PortalField>
        <PortalField
          hint="Use the retained private document reference, never a browser URL."
          label="Private signed document reference"
          required
        >
          <input
            name="evidence.documentReference"
            placeholder="private:agreements/signed.pdf"
          />
        </PortalField>
        <PortalField label="Signing certificate reference" hint="Optional">
          <input name="evidence.certificateReference" />
        </PortalField>
        <PortalField
          hint="The record must include every required signer."
          label="Confirmed signatory emails"
          required
        >
          <input
            defaultValue={record.draft.signatories.join(", ")}
            name="evidence.signatories"
          />
        </PortalField>
        <PortalField label="Date all parties completed signing" required>
          <input name="evidence.signedDate" type="date" />
        </PortalField>
        <PortalCheckbox
          label="I verified that every required party signed this exact revision."
          name="evidence.confirmed"
          required
        />
        <PortalButton loading={state.pending} type="submit">
          Confirm signed revision
        </PortalButton>
      </PortalCard>
      {state.message ? (
        <Notice tone={state.issues.length ? "error" : "success"}>
          <strong>{state.message}</strong>
        </Notice>
      ) : null}
    </form>
  );
}
