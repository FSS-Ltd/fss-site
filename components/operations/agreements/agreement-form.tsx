"use client";
import { useState } from "react";
import type { AgreementRecord } from "@/lib/operations/agreements/types";
import {
  minorToDecimal as penceToPounds,
  currencySymbol,
  type Currency,
} from "@/lib/operations/money";
import {
  PortalButton,
  PortalCheckbox,
  PortalSelect,
} from "@/components/portal/ui";
import { AgreementLines } from "./agreement-lines";
import { Field, value, emails } from "./form-fields";
import { useAgreementSubmit, moneyValue } from "./use-agreement-submit";
import styles from "./agreements.module.css";
export function AgreementForm({
  organisationId,
  engagementIds,
  engagementChoices,
  record,
  endpoint,
  evidenceMode = "manual",
  currency = "GBP",
}: {
  organisationId: string;
  engagementIds: string[];
  engagementChoices?: Array<{ id: string; name: string }>;
  record?: AgreementRecord;
  endpoint?: string;
  evidenceMode?: "manual" | "generated";
  currency?: Currency;
}): React.JSX.Element {
  const state = useAgreementSubmit(organisationId, endpoint);
  const [formVersion, setFormVersion] = useState(0);
  const draft = record?.draft;
  const retainedCurrency = draft?.currency ?? currency;
  return (
    <form
      key={formVersion}
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void state
          .submit(() => {
            const lines = Array.from(
              { length: Number(value(data, "lineCount")) },
              (_, i) => {
                const p = `draft.lines.${i}`;
                return {
                  serviceCode: value(data, `${p}.serviceCode`),
                  description: value(data, `${p}.description`),
                  quantity: Number(value(data, `${p}.quantity`)),
                  unitPence: moneyValue(data, `${p}.unitPence`),
                  discountPence: moneyValue(data, `${p}.discountPence`),
                  taxPence: moneyValue(data, `${p}.taxPence`),
                  recurrenceMonths: Number(
                    value(data, `${p}.recurrenceMonths`),
                  ),
                  startDate: value(data, `${p}.startDate`),
                  endDate: value(data, `${p}.endDate`) || null,
                };
              },
            );
            const next = {
              title: value(data, "draft.title"),
              scope: value(data, "draft.scope"),
              goals: value(data, "draft.goals"),
              terms: value(data, "draft.terms"),
              support: value(data, "draft.support"),
              responsibilities: value(data, "draft.responsibilities"),
              currency: retainedCurrency,
              ...(draft?.revenueShare
                ? { revenueShare: draft.revenueShare }
                : {}),
              taxTreatment: value(data, "draft.taxTreatment"),
              billingContact: value(data, "draft.billingContact"),
              signatories: emails(data, "draft.signatories"),
              documentHash:
                evidenceMode === "manual"
                  ? value(data, "draft.documentHash")
                  : "0".repeat(64),
              documentReference:
                evidenceMode === "manual"
                  ? value(data, "draft.documentReference")
                  : "private:agreement-drafts/unbound.pdf",
              noticeDays: Number(value(data, "draft.noticeDays")),
              minimumTermMonths: Number(value(data, "draft.minimumTermMonths")),
              requiredDepositPence: moneyValue(
                data,
                "draft.requiredDepositPence",
              ),
              assetsRequired: data.has("draft.assetsRequired"),
              lines,
              installments: Array.from(
                { length: Number(value(data, "installmentCount")) },
                (_, i) => ({
                  dueDate: value(data, `draft.installments.${i}.dueDate`),
                  amountPence: moneyValue(
                    data,
                    `draft.installments.${i}.amountPence`,
                  ),
                }),
              ),
            };
            return record
              ? {
                  action: "revise",
                  agreementId: record.id,
                  expectedVersion: record.version,
                  draft: next,
                }
              : {
                  action: "create",
                  engagementId: value(data, "engagementId"),
                  draft: next,
                };
          })
          .then((saved) => {
            if (saved && !record) setFormVersion((version) => version + 1);
          });
      }}
    >
      <fieldset disabled={state.pending}>
        <legend>
          {record ? "Create next draft revision" : "New agreement"}
        </legend>
        {!record && (
          <PortalSelect
            label="Reviewed engagement"
            name="engagementId"
            required
          >
            <option value="">Choose engagement</option>
            {(
              engagementChoices ?? engagementIds.map((id) => ({ id, name: id }))
            ).map((engagement) => (
              <option key={engagement.id} value={engagement.id}>
                {engagement.name}
              </option>
            ))}
          </PortalSelect>
        )}
        <Field
          issues={state.issues}
          label="Agreement title"
          name="draft.title"
          defaultValue={draft?.title}
          required
          maxLength={200}
        />
        {(
          ["scope", "goals", "terms", "support", "responsibilities"] as const
        ).map((key, i) => (
          <Field
            key={key}
            issues={state.issues}
            label={
              [
                "Scope",
                "Goals",
                "Contract terms",
                "Support expectations",
                "Client responsibilities",
              ][i]
            }
            name={`draft.${key}`}
            defaultValue={draft?.[key]}
            required
            multiline
          />
        ))}
        <div className={styles.grid}>
          <Field
            issues={state.issues}
            label="Approved billing email"
            name="draft.billingContact"
            type="email"
            defaultValue={draft?.billingContact}
            required
          />
          <Field
            issues={state.issues}
            label="Required signatory emails (comma separated)"
            name="draft.signatories"
            defaultValue={draft?.signatories.join(", ")}
            required
          />
          {evidenceMode === "manual" && (
            <>
              <Field
                issues={state.issues}
                label="Reviewed source document SHA-256"
                name="draft.documentHash"
                defaultValue={draft?.documentHash}
                required
              />
              <Field
                issues={state.issues}
                label="Private source document reference"
                name="draft.documentReference"
                placeholder="private:agreements/source.pdf"
                defaultValue={draft?.documentReference}
                required
              />
            </>
          )}
          <Field
            issues={state.issues}
            label="Agreed tax treatment"
            name="draft.taxTreatment"
            defaultValue={draft?.taxTreatment}
            required
          />
          <Field
            issues={state.issues}
            label="Notice period (days)"
            name="draft.noticeDays"
            type="number"
            min="0"
            max="3650"
            defaultValue={draft?.noticeDays ?? 0}
            required
          />
          <Field
            issues={state.issues}
            label="Minimum term (months)"
            name="draft.minimumTermMonths"
            type="number"
            min="0"
            max="120"
            defaultValue={draft?.minimumTermMonths ?? 0}
            required
          />
          <Field
            issues={state.issues}
            label={`Required cleared deposit (${currencySymbol(retainedCurrency)})`}
            name="draft.requiredDepositPence"
            inputMode="decimal"
            defaultValue={
              draft ? penceToPounds(draft.requiredDepositPence) : "0.00"
            }
            required
          />
        </div>
        {evidenceMode === "generated" && (
          <p>
            FSS Studio generates and retains the source PDF when electronic
            signing begins. No fingerprint or file path is entered here.
          </p>
        )}
        <PortalCheckbox
          defaultChecked={draft?.assetsRequired}
          label="Client assets are required before service starts"
          name="draft.assetsRequired"
        />
        <AgreementLines
          draft={draft}
          currency={retainedCurrency}
          issues={state.issues}
        />
        <PortalButton loading={state.pending} type="submit">
          {record ? "Save new revision" : "Save agreement"}
        </PortalButton>
      </fieldset>
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}
