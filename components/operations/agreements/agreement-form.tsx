"use client";
import { useState } from "react";
import type { AgreementRecord } from "@/lib/operations/agreements/types";
import { penceToGbp as penceToPounds } from "@/lib/operations/agreements/money-input";
import { AgreementLines } from "./agreement-lines";
import { Field, value, emails } from "./form-fields";
import { useAgreementSubmit, moneyValue } from "./use-agreement-submit";
import styles from "./agreements.module.css";
export function AgreementForm({
  organisationId,
  engagementIds,
  record,
}: {
  organisationId: string;
  engagementIds: string[];
  record?: AgreementRecord;
}): React.JSX.Element {
  const state = useAgreementSubmit(organisationId);
  const [formVersion, setFormVersion] = useState(0);
  const draft = record?.draft;
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
              currency: "GBP",
              taxTreatment: value(data, "draft.taxTreatment"),
              billingContact: value(data, "draft.billingContact"),
              signatories: emails(data, "draft.signatories"),
              documentHash: value(data, "draft.documentHash"),
              documentReference: value(data, "draft.documentReference"),
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
          <label className={styles.field}>
            <span>Reviewed engagement</span>
            <select name="engagementId" required>
              <option value="">Choose engagement</option>
              {engagementIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
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
            label="Required cleared deposit (£)"
            name="draft.requiredDepositPence"
            inputMode="decimal"
            defaultValue={
              draft ? penceToPounds(draft.requiredDepositPence) : "0.00"
            }
            required
          />
        </div>
        <label>
          <input
            type="checkbox"
            name="draft.assetsRequired"
            defaultChecked={draft?.assetsRequired}
          />{" "}
          Client assets are required before service starts
        </label>
        <AgreementLines draft={draft} issues={state.issues} />
        <button className={styles.primary} type="submit">
          {state.pending
            ? "Saving…"
            : record
              ? "Save new revision"
              : "Save agreement"}
        </button>
      </fieldset>
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}
