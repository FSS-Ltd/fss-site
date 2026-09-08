import { z } from "zod";
import type { OperationsDb } from "../db/client";
import type { OperationsFounder } from "../organisations/types";
import { withAgreementTransaction } from "../agreements/repository";
import { validateBillingScope } from "./scope";
import type { BillingScope } from "./domain-types";
export type BillingCommand = {
  id: string;
  createdAt: string;
  result: unknown;
  target: string;
};
export async function reserveBillingCommand(
  db: OperationsDb,
  founder: OperationsFounder | null,
  scope: BillingScope,
  target: string,
  commandKey: string,
  correlationId: string,
): Promise<BillingCommand> {
  validateBillingScope(scope);
  z.string().min(1).max(150).parse(commandKey);
  z.uuid().parse(correlationId);
  return withAgreementTransaction(db, founder, async (tx, actor) => {
    await tx`insert into operations.billing_commands(organisation_id,account_id,environment,command_key,target,created_by,correlation_id) values(${scope.organisationId},${scope.accountId},${scope.mode},${commandKey},${target},${actor.actorId},${correlationId}) on conflict do nothing`;
    const rows = await tx<
      BillingCommand[]
    >`select id,created_at::text as "createdAt",result,target from operations.billing_commands where organisation_id=${scope.organisationId} and account_id=${scope.accountId} and environment=${scope.mode} and (command_key=${commandKey} or target=${target})`;
    if (rows.some((row) => row.target !== target))
      throw new Error(
        "Billing command key was already used for a different obligation.",
      );
    if (rows.length !== 1) throw new Error("Billing command conflict.");
    return rows[0];
  });
}
export async function completeBillingCommand(
  db: OperationsDb,
  founder: OperationsFounder | null,
  scope: BillingScope,
  id: string,
  result: { providerId: string; invoiceId?: string | null },
): Promise<void> {
  await withAgreementTransaction(db, founder, async (tx) => {
    await tx`update operations.billing_commands set state='completed',result=${tx.json(result)} where organisation_id=${scope.organisationId} and account_id=${scope.accountId} and environment=${scope.mode} and id=${id} and state='pending'`;
  });
}
export function requireSafeReplay(createdAt: string, now = Date.now()): void {
  if (now - Date.parse(createdAt) >= 23 * 60 * 60 * 1000)
    throw new Error(
      "Billing operation needs provider reconciliation before retry; idempotency window expired.",
    );
}
export function commandProviderId(command: BillingCommand): string | null {
  return command.result === null
    ? null
    : z.object({ providerId: z.string().min(1) }).parse(command.result)
        .providerId;
}

export function commandInvoiceId(command: BillingCommand): string | null {
  if (command.result === null) return null;
  return (
    z
      .object({ invoiceId: z.string().min(1).nullable().optional() })
      .parse(command.result).invoiceId ?? null
  );
}
