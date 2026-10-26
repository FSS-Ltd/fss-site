"use client";
import type { CrmRecord } from "@/lib/growth/dashboard/crm-record";
import { CommandForm } from "./command-form";
import { FieldGroup, FormField } from "./form-field";
import { fieldText, nullableText } from "./form-values";
export function CompanyEditor({
  prospectId,
  business,
}: {
  prospectId: string;
  business: CrmRecord["business"];
}) {
  return (
    <CommandForm
      label="Edit company details"
      submitLabel="Save company"
      buildCommand={(data) => ({
        kind: "update_business",
        prospectId: prospectId,
        expectedVersion: business.version,
        tradingName: nullableText(data, "tradingName"),
        sector: fieldText(data, "sector"),
        locality: fieldText(data, "locality"),
        websiteUrl: nullableText(data, "websiteUrl"),
      })}
    >
      <FormField
        label="Trading name"
        name="tradingName"
        defaultValue={business.tradingName ?? ""}
        maxLength={200}
      />
      <FieldGroup>
        <FormField
          label="Sector"
          name="sector"
          defaultValue={business.sector}
          required
          maxLength={120}
        />
        <FormField
          label="Kent town"
          name="locality"
          defaultValue={business.locality}
          required
          maxLength={120}
        />
      </FieldGroup>
      <FormField
        label="Website URL"
        name="websiteUrl"
        type="url"
        defaultValue={business.websiteUrl ?? ""}
      />
    </CommandForm>
  );
}
