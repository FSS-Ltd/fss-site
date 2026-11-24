"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRef, useState } from "react";
import { CommandForm } from "./command-form";
import { CountryField } from "./country-field";
import { facebookSourceCommand } from "./facebook-source-values";
import { FieldGroup, FormField, TextField } from "./form-field";
import styles from "./crm.module.css";

export function FacebookSourceForm() {
  const router = useRouter();
  const [requestId] = useState(() => crypto.randomUUID());
  const intent = useRef<{ requestId: string; payload: string | null }>({
    requestId,
    payload: null,
  });
  const [countryCode, setCountryCode] = useState("GB");
  return (
    <section className={styles.panel}>
      <h2>Capture a Facebook prospect</h2>
      <p className={styles.muted}>
        Record a public page for research. Unknown details can remain blank.
        This does not verify the business or start outreach.
      </p>
      <CommandForm
        label="Capture Facebook prospect"
        submitLabel="Create lead"
        buildCommand={(data) => {
          let command = facebookSourceCommand(data, intent.current.requestId);
          const payload = JSON.stringify({ ...command, requestId: undefined });
          if (
            intent.current.payload !== null &&
            intent.current.payload !== payload
          ) {
            command = { ...command, requestId: crypto.randomUUID() };
          }
          intent.current = { requestId: command.requestId, payload };
          return command;
        }}
        renderSuccess={(result) =>
          result.alreadyExisted && result.prospectId ? (
            <p>
              A record already exists. Some submitted details may not have been
              saved. Review the record before continuing.{" "}
              <Link href={`/growth/prospects/${result.prospectId}`}>
                Open saved details
              </Link>
            </p>
          ) : null
        }
        onSuccess={(result) => {
          if (result.prospectId && !result.alreadyExisted)
            router.push(`/growth/prospects/${result.prospectId}`);
        }}
      >
        <FormField
          label="Public Facebook page URL"
          name="sourceUrl"
          type="url"
          required
        />
        <FormField
          label="Business name"
          name="businessName"
          required
          maxLength={200}
        />
        <CountryField value={countryCode} onChange={setCountryCode} />
        <FieldGroup>
          <FormField
            label="Corporate type (if known)"
            name="corporateType"
            maxLength={100}
          />
          <FormField
            label="Registration number (if known)"
            name="registrationNumber"
            maxLength={100}
          />
        </FieldGroup>
        <FieldGroup>
          <FormField
            label="First name (if known)"
            name="firstName"
            maxLength={100}
          />
          <FormField
            label="Last name (if known)"
            name="lastName"
            maxLength={100}
          />
        </FieldGroup>
        <FormField label="Email (if known)" name="email" type="email" />
        <TextField label="Opportunity" name="opportunity" maxLength={2000} />
        <FormField
          label="Recommended offer"
          name="offer"
          required
          maxLength={200}
        />
        <FormField
          label="Observed at"
          name="observedAt"
          type="datetime-local"
          required
        />
      </CommandForm>
    </section>
  );
}
