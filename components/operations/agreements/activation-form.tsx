"use client";
import type { AgreementRecord } from "@/lib/operations/agreements/types";
import { formatMoney, currencySymbol } from "@/lib/operations/money";
import { Field, value } from "./form-fields";
import { useAgreementSubmit, moneyValue } from "./use-agreement-submit";
import styles from "./agreements.module.css";
export function ActivationForm({
  organisationId,
  record,
  lineNumber,
  endpoint,
}: {
  organisationId: string;
  record: AgreementRecord;
  lineNumber: number;
  endpoint?: string;
}): React.JSX.Element {
  const state = useAgreementSubmit(organisationId, endpoint);
  const depositRequired = BigInt(record.draft.requiredDepositPence) > BigInt(0);
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void state.submit(() => ({
          action: "activate",
          agreementId: record.id,
          expectedVersion: record.version,
          lineNumber,
          evidence: {
            effectiveDate: value(data, "evidence.effectiveDate"),
            assetsReady: data.has("evidence.assetsReady"),
            deposit: depositRequired
              ? {
                  amountPence: moneyValue(data, "evidence.deposit.amountPence"),
                  verifiedDate: value(data, "evidence.deposit.verifiedDate"),
                  reference: value(data, "evidence.deposit.reference"),
                }
              : null,
          },
        }));
      }}
    >
      <fieldset disabled={state.pending}>
        <legend>Activate service {lineNumber}</legend>
        <p>
          Manual founder confirmation. This records service readiness; payment
          collection is separate.
        </p>
        <Field
          issues={state.issues}
          label="Effective service start"
          name="evidence.effectiveDate"
          type="date"
          required
        />
        {depositRequired && (
          <>
            <p>
              Required cleared deposit:{" "}
              {formatMoney(
                record.draft.requiredDepositPence,
                record.draft.currency,
              )}
            </p>
            <div className={styles.grid}>
              <Field
                issues={state.issues}
                label={`Verified cleared deposit (${currencySymbol(record.draft.currency)})`}
                name="evidence.deposit.amountPence"
                inputMode="decimal"
                required
              />
              <Field
                issues={state.issues}
                label="Deposit verification date"
                name="evidence.deposit.verifiedDate"
                type="date"
                required
              />
              <Field
                issues={state.issues}
                label="Reconciliation evidence reference"
                name="evidence.deposit.reference"
                required
              />
            </div>
          </>
        )}
        {record.draft.assetsRequired && (
          <label>
            <input type="checkbox" name="evidence.assetsReady" required />{" "}
            Required client assets are ready
          </label>
        )}
        <button className={styles.primary} type="submit">
          {state.pending ? "Activating…" : "Activate service"}
        </button>
      </fieldset>
      {state.message && <p role="status">{state.message}</p>}
    </form>
  );
}
