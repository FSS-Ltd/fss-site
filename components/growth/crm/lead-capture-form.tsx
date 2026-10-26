"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { captureLeadSchema } from "@/lib/growth/crm/schemas";
import { CountryField } from "./country-field";
import { CommandForm } from "./command-form";
import { ContactSourceFields } from "./contact-source-fields";
import { sourcedContact } from "./contact-form-values";
import { FieldGroup, FormField, TextField } from "./form-field";
import { fieldText, moneyPence, nullableText } from "./form-values";
import styles from "./crm.module.css";

export type EnquiryDefaults = {
  id: string;
  businessName: string;
  firstName: string;
  lastName: string;
  email: string;
  challenge: string | null;
};
export function LeadCaptureForm({ enquiry }: { enquiry?: EnquiryDefaults }) {
  const router = useRouter();
  const [requestId] = useState(() => crypto.randomUUID());
  const [countryCode, setCountryCode] = useState("GB");
  const [includeContact, setIncludeContact] = useState(false);
  return (
    <section className={styles.panel}>
      <h2>{enquiry ? "Convert enquiry to lead" : "Capture a lead"}</h2>
      <p className={styles.muted}>
        Create a reviewable business record in any country. Existing company
        identities are reused. This does not qualify the lead or start outreach.
      </p>
      <CommandForm
        label="Capture lead"
        submitLabel={enquiry ? "Create lead from enquiry" : "Create lead"}
        buildCommand={(data) =>
          captureLeadSchema.parse({
            kind: "capture",
            requestId,
            inboundLeadId: enquiry?.id,
            businessName: fieldText(data, "businessName"),
            countryCode: fieldText(data, "countryCode"),
            companyNumber: fieldText(data, "companyNumber"),
            corporateType: fieldText(data, "corporateType"),
            sector: fieldText(data, "sector"),
            locality: fieldText(data, "locality"),
            sourceUrl: fieldText(data, "sourceUrl"),
            websiteUrl: nullableText(data, "websiteUrl"),
            opportunitySummary: fieldText(data, "opportunitySummary"),
            recommendedOffer: fieldText(data, "recommendedOffer"),
            oneOffMinPence: moneyPence(data, "oneOffMin"),
            oneOffMaxPence: moneyPence(data, "oneOffMax"),
            monthlyPence: moneyPence(data, "monthly"),
            contact: includeContact ? sourcedContact(data) : undefined,
          })
        }
        onSuccess={(result) => {
          if (result.prospectId)
            router.push(`/growth/prospects/${result.prospectId}`);
        }}
      >
        <CountryField value={countryCode} onChange={setCountryCode} />
        <FieldGroup>
          <FormField
            label="Legal business name"
            name="businessName"
            defaultValue={enquiry?.businessName}
            required
            maxLength={200}
          />
          <FormField
            label="Company registration number"
            name="companyNumber"
            required
            maxLength={80}
            help={
              countryCode === "GB"
                ? "Eight characters from Companies House, including any leading zeros or letters."
                : "Use the registration number issued in the selected country."
            }
          />
        </FieldGroup>
        <label className={styles.field}>
          <span>Corporate type</span>
          <select name="corporateType">
            <option value="limited_company">
              Limited company / corporation
            </option>
            <option value="llp">Limited liability partnership</option>
            <option value="scottish_partnership">Scottish partnership</option>
            <option value="other_corporate">Other corporate body</option>
          </select>
        </label>
        <FieldGroup>
          <FormField label="Sector" name="sector" required maxLength={120} />
          <FormField label="City" name="locality" required maxLength={120} />
        </FieldGroup>
        <FormField
          label="Business source URL"
          name="sourceUrl"
          type="url"
          required
          help="Source identifying this company. Verification stays pending."
        />
        <FormField label="Website URL" name="websiteUrl" type="url" />
        <TextField
          label="Opportunity"
          name="opportunitySummary"
          defaultValue={enquiry?.challenge ?? ""}
        />
        <FormField
          label="Recommended offer"
          name="recommendedOffer"
          required
          maxLength={300}
        />
        <FieldGroup>
          <FormField
            label="One-off minimum (£)"
            name="oneOffMin"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
            required
          />
          <FormField
            label="One-off maximum (£)"
            name="oneOffMax"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
            required
          />
        </FieldGroup>
        <FormField
          label="Estimated monthly (£/month)"
          name="monthly"
          type="number"
          min="0"
          step="0.01"
          defaultValue="0"
          required
        />
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={includeContact}
            onChange={(event) => setIncludeContact(event.target.checked)}
          />
          Add a sourced contact
        </label>
        {includeContact && (
          <ContactSourceFields
            defaults={
              enquiry
                ? {
                    firstName: enquiry.firstName,
                    lastName: enquiry.lastName,
                    email: enquiry.email,
                  }
                : undefined
            }
          />
        )}
      </CommandForm>
    </section>
  );
}
