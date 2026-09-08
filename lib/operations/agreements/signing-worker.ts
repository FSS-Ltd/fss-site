import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { z } from "zod";
import { operationsEnabled, type OperationsDb } from "../db/client";
import { loadSigningApprovals } from "./signing-repository";
import { renderSignedAgreement, signingAudit } from "./signing-render";

let sharedDb: OperationsDb | undefined;
export function signingEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return operationsEnabled(env) && env.OPERATIONS_SIGNING_ENABLED === "true";
}
export function getSigningWorkerDb(): OperationsDb {
  if (!signingEnabled()) throw new Error("Agreement signing is disabled.");
  const url = process.env.OPERATIONS_SIGNING_DATABASE_URL;
  if (!url) throw new Error("Agreement signing is not configured.");
  sharedDb ??= postgres(url, {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    connection: { options: "-c role=operations_signing_worker" },
  });
  return sharedDb;
}
export async function completeAgreementSigning(
  db: OperationsDb,
  approvalId: string,
  correlationId: string,
): Promise<boolean> {
  z.uuid().parse(approvalId);
  z.uuid().parse(correlationId);
  const result = await db.begin(async (tx) => {
    const [role] = await tx<{ name: string }[]>`select current_user as name`;
    if (role.name !== "operations_signing_worker")
      throw new Error("Signing worker authorization required.");
    const approval = (await loadSigningApprovals(tx, null, approvalId))[0];
    if (!approval) return { completed: false };
    if (approval.status === "completed") return { completed: false };
    if (
      approval.status !== "approved" ||
      approval.signatures.length !== approval.requiredSigners.length
    )
      return { completed: false };
    const [source] = await tx<
      { bytes: Buffer }[]
    >`select source_pdf as bytes from operations.signing_approvals where id=${approvalId}`;
    const audit = signingAudit(approval);
    const signed = await renderSignedAgreement(approval, source.bytes, audit);
    const [row] = await tx<
      { completed: boolean }[]
    >`select operations.complete_agreement_signing(${approvalId},${signed},${audit},${correlationId}) as completed`;
    return row;
  });
  return result.completed;
}
export async function runSigningCompletionWorker(
  db: OperationsDb,
  options: { limit?: number } = {},
): Promise<{ completed: number; failed: number }> {
  const limit = z
    .number()
    .int()
    .min(1)
    .max(100)
    .parse(options.limit ?? 25);
  const [role] = await db<{ name: string }[]>`select current_user as name`;
  if (role.name !== "operations_signing_worker")
    throw new Error("Signing worker authorization required.");
  const pending = await db<
    { id: string }[]
  >`select p.id from operations.signing_approvals p where p.status='approved' and p.completion_next_attempt_at<=now() and (select count(*) from operations.signing_signatures s where s.approval_id=p.id)=jsonb_array_length(p.snapshot->'signatories') order by p.completion_next_attempt_at,p.id limit ${limit}`;
  let completed = 0;
  let failed = 0;
  for (const row of pending) {
    try {
      if (await completeAgreementSigning(db, row.id, randomUUID())) completed++;
    } catch {
      await db`update operations.signing_approvals set completion_attempts=completion_attempts+1,completion_next_attempt_at=now()+interval '15 minutes' where id=${row.id} and status='approved'`;
      failed++;
    }
  }
  return { completed, failed };
}
