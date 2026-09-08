import { z } from "zod";
import type { OperationsDb } from "../db/client";
import type {
  BillingEventReceipt,
  ProviderScope,
} from "./reconciliation-types";
export type { BillingEventReceipt } from "./reconciliation-types";
const receiptSchema = z.object({
  accountId: z.string().regex(/^acct_[A-Za-z0-9]+$/),
  mode: z.enum(["test", "live"]),
  eventId: z.string().regex(/^evt_[A-Za-z0-9]+$/),
  eventType: z
    .string()
    .regex(/^[a-z_]+(?:\.[a-z_]+)+$/)
    .max(100),
  objectId: z
    .string()
    .regex(/^[A-Za-z0-9_]+$/)
    .max(255),
  payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
  occurredAt: z.iso.datetime(),
});
export async function recordBillingEvent(
  db: OperationsDb,
  receipt: BillingEventReceipt,
): Promise<"recorded" | "duplicate"> {
  const value = receiptSchema.parse(receipt);
  const rows =
    await db`insert into operations.billing_provider_events(account_id,environment,provider_event_id,event_type,object_id,payload_hash,occurred_at) values(${value.accountId},${value.mode},${value.eventId},${value.eventType},${value.objectId},${value.payloadHash},${value.occurredAt}) on conflict(account_id,environment,provider_event_id) do nothing returning id`;
  return rows.length ? "recorded" : "duplicate";
}
export type ClaimedBillingEvent = BillingEventReceipt & {
  id: string;
  leaseToken: string;
  attempts: number;
};
export async function claimBillingEvents(
  db: OperationsDb,
  scope: ProviderScope,
  limit: number,
): Promise<ClaimedBillingEvent[]> {
  z.number().int().min(1).max(20).parse(limit);
  return db.begin(async (tx) => [
    ...(await tx<ClaimedBillingEvent[]>`
    with due as (select id from operations.billing_provider_events where account_id=${scope.accountId} and environment=${scope.mode} and state in ('pending','processing') and next_attempt_at<=now() and (lease_until is null or lease_until<now()) order by received_at,id for update skip locked limit ${limit})
    update operations.billing_provider_events e set state='processing',lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',attempts=attempts+1 from due where e.id=due.id returning e.id,e.account_id as "accountId",e.environment as mode,e.provider_event_id as "eventId",e.event_type as "eventType",e.object_id as "objectId",e.payload_hash as "payloadHash",e.occurred_at::text as "occurredAt",e.lease_token as "leaseToken",e.attempts`),
  ]);
}
