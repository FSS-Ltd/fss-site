"use client";
import { useState } from "react";
import type { AgreementDraft } from "@/lib/operations/agreements/types";
import { penceToGbp as penceToPounds } from "@/lib/operations/agreements/money-input";
import { Field, type FieldIssues } from "./form-fields";
import styles from "./agreements.module.css";
export function AgreementLines({
  draft,
  issues,
}: {
  draft?: AgreementDraft;
  issues: FieldIssues;
}): React.JSX.Element {
  const [count, setCount] = useState(draft?.lines.length ?? 1);
  const [installments, setInstallments] = useState(
    draft?.installments.length ?? 1,
  );
  return (
    <>
      <input type="hidden" name="lineCount" value={count} />
      {Array.from({ length: count }, (_, index) => {
        const line = draft?.lines[index];
        const prefix = `draft.lines.${index}`;
        return (
          <fieldset key={index}>
            <legend>Service {index + 1}</legend>
            <div className={styles.grid}>
              <Field
                issues={issues}
                label="Service code"
                name={`${prefix}.serviceCode`}
                defaultValue={line?.serviceCode}
                required
              />
              <Field
                issues={issues}
                label="Description"
                name={`${prefix}.description`}
                defaultValue={line?.description}
                required
              />
              <Field
                issues={issues}
                label="Quantity"
                name={`${prefix}.quantity`}
                defaultValue={line?.quantity ?? 1}
                type="number"
                min="1"
                max="10000"
                required
              />
              {(["unitPence", "discountPence", "taxPence"] as const).map(
                (key, i) => (
                  <Field
                    key={key}
                    issues={issues}
                    label={
                      [
                        "Unit price (£)",
                        "Line discount (£)",
                        "Line tax amount (£)",
                      ][i]
                    }
                    name={`${prefix}.${key}`}
                    inputMode="decimal"
                    defaultValue={
                      line
                        ? penceToPounds(line[key])
                        : key === "discountPence"
                          ? "0.00"
                          : ""
                    }
                    required
                  />
                ),
              )}
              <label className={styles.field}>
                <span>Billing interval</span>
                <select
                  name={`${prefix}.recurrenceMonths`}
                  defaultValue={line?.recurrenceMonths ?? 0}
                >
                  <option value="0">One-off</option>
                  <option value="1">Monthly</option>
                  <option value="3">Quarterly</option>
                  <option value="12">Annual</option>
                </select>
              </label>
              <Field
                issues={issues}
                label="Contract start date"
                name={`${prefix}.startDate`}
                type="date"
                defaultValue={line?.startDate}
                required
              />
              <Field
                issues={issues}
                label="Contract end date (optional)"
                name={`${prefix}.endDate`}
                type="date"
                defaultValue={line?.endDate ?? ""}
              />
            </div>
          </fieldset>
        );
      })}
      <div className={styles.actions}>
        <button
          type="button"
          onClick={() => setCount(count + 1)}
          disabled={count >= 30}
        >
          Add service
        </button>
        {count > 1 && (
          <button type="button" onClick={() => setCount(count - 1)}>
            Remove last service
          </button>
        )}
      </div>
      <fieldset>
        <legend>One-off installments</legend>
        <p>
          Allocate the full one-off total including tax. Remove installments for
          recurring-only agreements.
        </p>
        <input type="hidden" name="installmentCount" value={installments} />
        {issues
          .filter((i) => i.path === "draft.installments")
          .map((i) => (
            <p className={styles.error} key={`${i.path}:${i.message}`}>
              {i.message}
            </p>
          ))}
        {Array.from({ length: installments }, (_, index) => (
          <div className={styles.grid} key={index}>
            <Field
              issues={issues}
              label={`Installment ${index + 1} due date`}
              name={`draft.installments.${index}.dueDate`}
              type="date"
              defaultValue={draft?.installments[index]?.dueDate}
              required
            />
            <Field
              issues={issues}
              label={`Installment ${index + 1} amount (£)`}
              name={`draft.installments.${index}.amountPence`}
              inputMode="decimal"
              defaultValue={
                draft?.installments[index]
                  ? penceToPounds(draft.installments[index].amountPence)
                  : ""
              }
              required
            />
          </div>
        ))}
        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => setInstallments(installments + 1)}
            disabled={installments >= 30}
          >
            Add installment
          </button>
          {installments > 0 && (
            <button
              type="button"
              onClick={() => setInstallments(installments - 1)}
            >
              Remove last installment
            </button>
          )}
        </div>
      </fieldset>
    </>
  );
}
