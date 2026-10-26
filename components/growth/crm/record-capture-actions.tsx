"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CommandForm } from "./command-form";
import { ContactSourceFields, sourcedContact } from "./contact-source-fields";
import styles from "./crm.module.css";
export function AttachContactForm({
  prospectId,
  version,
}: {
  prospectId: string;
  version: number;
}) {
  return (
    <details>
      <summary>Add a sourced contact</summary>
      <CommandForm
        label="Add contact"
        submitLabel="Add contact"
        buildCommand={(data) => ({
          kind: "attach_contact",
          prospectId,
          expectedVersion: version,
          contact: sourcedContact(data),
        })}
      >
        <ContactSourceFields />
      </CommandForm>
    </details>
  );
}
export function CreateDealForm({
  prospectId,
  version,
}: {
  prospectId: string;
  version: number;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const router = useRouter();
  return (
    <CommandForm
      label="Create commercial deal"
      submitLabel="Create deal"
      buildCommand={() => ({
        kind: "create_opportunity",
        prospectId,
        expectedVersion: version,
        requestId,
      })}
      onSuccess={(result) => {
        if (result.recordId) router.push(`/growth/deals/${result.recordId}`);
      }}
    >
      <p className={styles.muted}>
        Start a deal in New using the lead’s estimated offer. Qualification and
        stage moves remain explicit.
      </p>
    </CommandForm>
  );
}
