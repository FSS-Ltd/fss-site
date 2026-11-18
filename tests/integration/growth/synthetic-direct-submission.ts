import assert from "node:assert/strict";
import type { GrowthDb } from "../../../lib/growth/db/types";

// Fixture-only database state. This does not exercise the future Gmail transport.
export async function seedSyntheticDirectSubmission(
  db: GrowthDb,
  reservationId: string,
  providerMessageId: string,
  providerThreadId: string,
): Promise<void> {
  const rows = await db<{ id: string }[]>`
    update growth.outreach_reservations r set status='accepted',provider_message_id=${providerMessageId},provider_thread_id=${providerThreadId},
      direct_submission_evidence=jsonb_build_object('version',1,'kind','gmail_api_send_message_v1','reservationId',r.id::text,'accountId',r.account_id,
        'connectionId',r.connection_id::text,'googleSubject',r.issued_snapshot->>'googleSubject','grantEpoch',r.grant_epoch,
        'rfcMessageId',r.rfc_message_id,'rawSha256',r.issued_snapshot_hash,'providerMessageId',${providerMessageId}::text,'providerThreadId',${providerThreadId}::text)
    where r.id=${reservationId} and r.status='submitting' returning id`;
  assert.equal(rows.length, 1);
}
