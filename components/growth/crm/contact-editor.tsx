"use client";
import type { CrmRecord } from "@/lib/growth/dashboard/crm-record";
import { CommandForm } from "./command-form";
import { FieldGroup, FormField } from "./form-field";
import { fieldText, nullableText } from "./form-values";
import styles from "./crm.module.css";
export function ContactEditor({
  prospectId,
  contact,
}: {
  prospectId: string;
  contact: NonNullable<CrmRecord["contact"]>;
}) {
  return (
    <CommandForm
      label="Edit contact details"
      submitLabel="Save contact"
      buildCommand={(data) => ({
        kind: "update_contact",
        prospectId: prospectId,
        expectedVersion: contact.version,
        firstName: fieldText(data, "firstName"),
        lastName: fieldText(data, "lastName"),
        roleTitle: nullableText(data, "roleTitle"),
      })}
    >
      <p className={styles.muted}>{contact.email}</p>
      <FieldGroup>
        <FormField
          label="First name"
          name="firstName"
          defaultValue={contact.firstName}
          required
          maxLength={100}
        />
        <FormField
          label="Last name"
          name="lastName"
          defaultValue={contact.lastName}
          required
          maxLength={100}
        />
      </FieldGroup>
      <FormField
        label="Role"
        name="roleTitle"
        defaultValue={contact.roleTitle ?? ""}
        maxLength={150}
      />
    </CommandForm>
  );
}
