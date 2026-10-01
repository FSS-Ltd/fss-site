import { z } from "zod";
import { parseAgreementDraft, totalLinePence } from "../agreements/validation";
import { withAgreementTransaction } from "../agreements/repository";
import type { OperationsDb } from "../db/client";
import type { OperationsFounder } from "../organisations/types";
import type { BillingObligation, BillingScope } from "./domain-types";
import { validateBillingScope } from "./scope";

export function deriveBillingObligations(
  input: unknown,
  signedDate: string,
): BillingObligation[] {
  const draft = parseAgreementDraft(input);
  z.iso.date().parse(signedDate);
  const obligations: BillingObligation[] = draft.installments.map(
    (item, index) => ({
      currency: draft.currency,
      key: `installment:${index + 1}`,
      owner: "invoice",
      amountPence: item.amountPence,
      dueDate: item.dueDate,
      endDate: null,
      recurrenceMonths: 0,
      description: `${draft.title}: installment ${index + 1}`,
    }),
  );
  draft.lines.forEach((line, index) => {
    if (draft.revenueShare || line.recurrenceMonths === 0) return;
    obligations.push({
      currency: draft.currency,
      key: `line:${index + 1}`,
      owner: "subscription",
      amountPence: totalLinePence(line),
      dueDate: line.startDate,
      endDate: line.endDate,
      recurrenceMonths: line.recurrenceMonths,
      description: line.description,
    });
  });
  if (obligations.some((item) => item.dueDate < signedDate))
    throw new Error("Billing dates must not precede the signed agreement.");
  return obligations;
}
export async function createBillingSchedule(
  db: OperationsDb,
  founder: OperationsFounder | null,
  scope: BillingScope,
  agreementId: string,
  revision: number,
  correlationId: string,
): Promise<string[]> {
  validateBillingScope(scope);
  z.uuid().parse(agreementId);
  z.uuid().parse(correlationId);
  z.number().int().positive().parse(revision);
  return withAgreementTransaction(db, founder, async (tx, actor) => {
    const [signed] = await tx<
      { snapshot: unknown; signedDate: string }[]
    >`select r.snapshot,e.evidence->>'signedDate' as "signedDate" from operations.agreement_revisions r join operations.signature_evidence e using(organisation_id,agreement_id,revision) where r.organisation_id=${scope.organisationId} and r.agreement_id=${agreementId} and r.revision=${revision}`;
    if (!signed) throw new Error("Signed agreement revision not found.");
    const snapshot = parseAgreementDraft(signed.snapshot);
    const ids: string[] = [];
    for (const obligation of deriveBillingObligations(
      signed.snapshot,
      signed.signedDate,
    )) {
      const [row] = await tx<
        { id: string }[]
      >`insert into operations.billing_schedules(organisation_id,agreement_id,revision,account_id,environment,obligation_key,owner,amount_pence,currency,due_date,end_date,recurrence_months,description,signed_snapshot,created_by,correlation_id) values(${scope.organisationId},${agreementId},${revision},${scope.accountId},${scope.mode},${obligation.key},${obligation.owner},${obligation.amountPence},${obligation.currency},${obligation.dueDate},${obligation.endDate},${obligation.recurrenceMonths},${obligation.description},${tx.json(snapshot)},${actor.actorId},${correlationId}) on conflict(organisation_id,agreement_id,revision,environment,obligation_key) do nothing returning id`;
      if (row) ids.push(row.id);
      else {
        const [existing] = await tx<
          { id: string; accountId: string }[]
        >`select id,account_id as "accountId" from operations.billing_schedules where organisation_id=${scope.organisationId} and agreement_id=${agreementId} and revision=${revision} and environment=${scope.mode} and obligation_key=${obligation.key}`;
        if (existing.accountId !== scope.accountId)
          throw new Error(
            "Billing obligation already belongs to another account.",
          );
        ids.push(existing.id);
      }
    }
    return ids;
  });
}
