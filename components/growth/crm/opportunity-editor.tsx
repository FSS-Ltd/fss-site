"use client";
import type { CrmRecord } from "@/lib/growth/dashboard/crm-record";
import { CommandForm } from "./command-form";
import { FieldGroup, FormField } from "./form-field";
import { fieldText, moneyPence, nullableText } from "./form-values";
export function OpportunityEditor({
  prospectId,
  engagement,
}: {
  prospectId: string;
  engagement: NonNullable<CrmRecord["engagement"]>;
}) {
  return (
    <CommandForm
      label="Edit deal properties"
      submitLabel="Save deal"
      buildCommand={(data) => ({
        kind: "update_opportunity",
        prospectId: prospectId,
        engagementId: engagement.id,
        expectedVersion: engagement.version,
        name: fieldText(data, "name"),
        oneOffValuePence: moneyPence(data, "oneOff"),
        monthlyValuePence: moneyPence(data, "monthly"),
        probabilityPercent: Number(fieldText(data, "probability")),
        expectedCloseDate: nullableText(data, "expectedClose"),
      })}
    >
      <FormField
        label="Deal name"
        name="name"
        defaultValue={engagement.name}
        required
        maxLength={300}
      />
      <FieldGroup>
        <FormField
          label="Deal one-off (£)"
          name="oneOff"
          type="number"
          min="0"
          step="0.01"
          defaultValue={engagement.oneOffValuePence / 100}
          required
        />
        <FormField
          label="Deal monthly (£/month)"
          name="monthly"
          type="number"
          min="0"
          step="0.01"
          defaultValue={engagement.monthlyValuePence / 100}
          required
        />
      </FieldGroup>
      <FieldGroup>
        <FormField
          label="Probability (%)"
          name="probability"
          type="number"
          min="0"
          max="100"
          step="1"
          defaultValue={engagement.probabilityPercent}
          required
        />
        <FormField
          label="Expected close"
          name="expectedClose"
          type="date"
          defaultValue={engagement.expectedCloseDate ?? ""}
        />
      </FieldGroup>
    </CommandForm>
  );
}
