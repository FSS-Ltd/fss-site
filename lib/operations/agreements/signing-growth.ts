import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { GrowthDb } from "../../growth/db/types";
import { postgresEngagementTransitionRepository } from "../../growth/pipeline/engagement-repository";
import { createEngagementTransitioner } from "../../growth/pipeline/transition-engagement";
import type { OperationsDb } from "../db/client";
import { draftSchema } from "./validation";

type Completion = {
  id: string;
  engagement_id: string;
  signed_at: Date;
  financial_snapshot: unknown;
  lease_token: string;
};
type ReviewReason =
  | "engagement_missing"
  | "engagement_terminal"
  | "engagement_not_ready"
  | "invalid_financials";
export function signingGrowthValues(
  snapshot: unknown,
): { oneOffValuePence: number; monthlyValuePence: number } | null {
  const parsed = draftSchema.safeParse(snapshot);
  if (!parsed.success) return null;
  let oneOff = BigInt(0);
  let yearlyEquivalent = BigInt(0);
  for (const line of parsed.data.lines) {
    const net =
      BigInt(line.unitPence) * BigInt(line.quantity) -
      BigInt(line.discountPence);
    if (line.recurrenceMonths === 0) oneOff += net;
    else yearlyEquivalent += net * (BigInt(12) / BigInt(line.recurrenceMonths));
  }
  // The legacy Growth projection accepts whole pence only. Keep the exact
  // agreement in Operations and route unrepresentable amounts for review.
  if (yearlyEquivalent % BigInt(12) !== BigInt(0)) return null;
  const monthly = yearlyEquivalent / BigInt(12);
  if (
    oneOff + monthly <= BigInt(0) ||
    oneOff > BigInt(Number.MAX_SAFE_INTEGER) ||
    monthly > BigInt(Number.MAX_SAFE_INTEGER)
  )
    return null;
  return {
    oneOffValuePence: Number(oneOff),
    monthlyValuePence: Number(monthly),
  };
}
async function projectCompletion(
  db: GrowthDb,
  row: Completion,
): Promise<ReviewReason | null> {
  const [engagement] = await db<
    { stage: string; version: number }[]
  >`select stage,version from growth.delivery_engagements where id=${row.engagement_id}`;
  if (!engagement) return "engagement_missing";
  if (engagement.stage === "won") return null;
  if (engagement.stage === "lost") return "engagement_terminal";
  if (engagement.stage !== "negotiation") return "engagement_not_ready";
  const values = signingGrowthValues(row.financial_snapshot);
  if (!values) return "invalid_financials";
  const transition = createEngagementTransitioner({
    repository: postgresEngagementTransitionRepository,
    now: () => new Date(row.signed_at),
  });
  await transition(
    db,
    {
      dimension: "commercial",
      engagementId: row.engagement_id,
      expectedVersion: engagement.version,
      toStage: "won",
      reasonCode: "agreement_signed",
      ...values,
    },
    { system: "operations-signing", correlationId: row.id },
  );
  return null;
}
export async function runSigningGrowthWorker(
  db: OperationsDb,
  growth: GrowthDb,
  options: { limit?: number } = {},
): Promise<{ completed: number; review: number; failed: number }> {
  const limit = z
    .number()
    .int()
    .min(1)
    .max(25)
    .parse(options.limit ?? 5);
  const [role] = await db<{ name: string }[]>`select current_user as name`;
  if (role.name !== "operations_signing_worker")
    throw new Error("Signing worker authorization required.");
  const token = randomUUID();
  const rows = await db<Completion[]>`with pending as (
    select id from operations.signing_completion_outbox where
      (state='pending' and next_attempt_at<=now()) or (state='processing' and lease_until<now())
    order by next_attempt_at,id for update skip locked limit ${limit}
  ) update operations.signing_completion_outbox o set state='processing',lease_token=${token},lease_until=now()+interval '5 minutes',attempts=attempts+1
    from pending where o.id=pending.id returning o.id,o.engagement_id,o.signed_at,o.financial_snapshot,o.lease_token`;
  const result = { completed: 0, review: 0, failed: 0 };
  for (const row of rows) {
    try {
      const reason = await projectCompletion(growth, row);
      const updated =
        await db`update operations.signing_completion_outbox set state=${reason ? "review" : "completed"},failure_code=${reason},completed_at=${reason ? null : new Date()},lease_token=null,lease_until=null where id=${row.id} and state='processing' and lease_token=${row.lease_token}`;
      if (updated.count) result[reason ? "review" : "completed"]++;
    } catch {
      await db`update operations.signing_completion_outbox set state='pending',failure_code='growth_unavailable',next_attempt_at=now()+interval '5 minutes',lease_token=null,lease_until=null where id=${row.id} and state='processing' and lease_token=${row.lease_token}`;
      result.failed++;
    }
  }
  return result;
}
