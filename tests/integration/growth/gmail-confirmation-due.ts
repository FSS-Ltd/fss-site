import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { GrowthDb } from "../../../lib/growth/db/types";
import { postgresSequenceDispatchRepository } from "../../../lib/growth/sequences/dispatcher-repository";
import { seedSyntheticDirectSubmission } from "./synthetic-direct-submission";

// Synthetic accepted rows test scheduler fairness only, not provider provenance.
export async function exerciseConfirmationDueFairness(
  admin: GrowthDb,
  db: GrowthDb,
  sourceId: string,
  connectionId: string,
): Promise<void> {
  const ids: string[] = [];
  try {
    for (let index = 0; index < 26; index += 1) {
      const id = randomUUID();
      ids.push(id);
      await admin`
        insert into growth.outreach_reservations(id,idempotency_key,email_message_id,sequence_id,account_id,london_day,status,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,fence,lease_until)
        select ${id},${`due-test:${id}`},email_message_id,sequence_id,account_id,london_day,'reserved',connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,${randomUUID()},fence,lease_until
        from growth.outreach_reservations where id=${sourceId}`;
      await admin`
        update growth.outreach_reservations r set status='submitting',submitted_at=clock_timestamp(),issued_snapshot=source.issued_snapshot,issued_snapshot_hash=source.issued_snapshot_hash
        from growth.outreach_reservations source where r.id=${id} and source.id=${sourceId}`;
      await seedSyntheticDirectSubmission(
        admin,
        id,
        `due-test-${id}`,
        `due-thread-${id}`,
      );
      await admin`update growth.outreach_reservations set completed_at=clock_timestamp()-interval '1 hour' where id=${id}`;
    }
    const first =
      await postgresSequenceDispatchRepository.claimPendingConfirmations(
        db,
        connectionId,
      );
    const second =
      await postgresSequenceDispatchRepository.claimPendingConfirmations(
        db,
        connectionId,
      );
    assert.equal(first.length, 25);
    assert.equal(new Set(first).size, 25);
    assert.equal(first.filter((id) => ids.includes(id)).length, 25);
    assert.equal(second.filter((id) => ids.includes(id)).length, 1);
    assert.equal(
      first.some((id) => second.includes(id)),
      false,
    );
  } finally {
    await admin`delete from growth.outreach_reservations where id=any(${ids}::uuid[])`;
  }
}
