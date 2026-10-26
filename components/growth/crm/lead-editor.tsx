"use client";
import type { CrmRecord } from "@/lib/growth/dashboard/crm-record";
import { CommandForm } from "./command-form";
import { FieldGroup, FormField, TextField } from "./form-field";
import { fieldText, moneyPence } from "./form-values";
export function LeadEditor({ record }: { record: CrmRecord }) {
  return (
    <CommandForm
      label="Edit lead opportunity"
      submitLabel="Save lead"
      buildCommand={(data) => ({
        kind: "update_prospect",
        prospectId: record.prospectId,
        expectedVersion: record.prospectVersion,
        opportunitySummary: fieldText(data, "opportunitySummary"),
        recommendedOffer: fieldText(data, "recommendedOffer"),
        oneOffMinPence: moneyPence(data, "oneOffMin"),
        oneOffMaxPence: moneyPence(data, "oneOffMax"),
        monthlyPence: moneyPence(data, "monthly"),
      })}
    >
      <TextField
        label="Opportunity"
        name="opportunitySummary"
        defaultValue={record.opportunitySummary}
      />
      <FormField
        label="Recommended offer"
        name="recommendedOffer"
        defaultValue={record.recommendedOffer}
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
          defaultValue={record.oneOffMinPence / 100}
          required
        />
        <FormField
          label="One-off maximum (£)"
          name="oneOffMax"
          type="number"
          min="0"
          step="0.01"
          defaultValue={record.oneOffMaxPence / 100}
          required
        />
      </FieldGroup>
      <FormField
        label="Estimated monthly (£/month)"
        name="monthly"
        type="number"
        min="0"
        step="0.01"
        defaultValue={record.monthlyPence / 100}
        required
      />
    </CommandForm>
  );
}
