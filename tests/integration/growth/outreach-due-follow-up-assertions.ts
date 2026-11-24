import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { GrowthDb } from "../../../lib/growth/db/types";
import {
  claimFollowUps,
  settleFollowUp,
} from "../../../lib/growth/campaigns/outreach-due-worker";

export async function exerciseDueFollowUpLease(
  admin: GrowthDb,
  db: GrowthDb,
  input: { membershipId: string; connectionId: string },
): Promise<void> {
  const [job] = await admin<
    { id: string; dueAt: Date }[]
  >`select id,due_at as "dueAt" from growth.outreach_jobs where membership_id=${input.membershipId} and job_type='follow_up' and idempotency_key=${`campaign-followup:${input.membershipId}:1`}`;
  assert.ok(job);
  try {
    await admin`update growth.outreach_jobs set status='pending',lease_owner=null,lease_until=null,due_at=clock_timestamp()+interval '1 minute' where id=${job.id}`;
    assert.equal(
      (
        await claimFollowUps(db, {
          connectionId: input.connectionId,
          workerId: "too-early",
          limit: 1,
        })
      ).length,
      0,
    );
    await admin`update growth.outreach_jobs set due_at=${job.dueAt} where id=${job.id}`;
    assert.equal(
      (
        await claimFollowUps(db, {
          connectionId: randomUUID(),
          workerId: "wrong-account",
          limit: 1,
        })
      ).length,
      0,
    );
    const claimed = await claimFollowUps(db, {
      connectionId: input.connectionId,
      workerId: "due-test",
      limit: 1,
    });
    assert.equal(claimed.length, 1);
    assert.equal(claimed[0]?.id, job.id);
    const item = claimed[0];
    assert.ok(item);
    const attempt = {
      jobId: item.id,
      leaseOwner: "due-test",
      leaseRevision: item.revision,
      connectionId: input.connectionId,
      coverageId: randomUUID(),
      reason: "reply_coverage_unknown",
    };
    assert.equal(
      await settleFollowUp(db, { ...attempt, leaseRevision: "999999" }),
      "stale",
    );
    const [unchanged] = await admin<
      { status: string; owner: string }[]
    >`select status,lease_owner as owner from growth.outreach_jobs where id=${job.id}`;
    assert.deepEqual(unchanged, { status: "leased", owner: "due-test" });
    assert.equal(await settleFollowUp(db, attempt), "retry");
    const [retry] = await admin<
      { status: string; reason: string; future: boolean }[]
    >`select status,last_error_code as reason,due_at>clock_timestamp() as future from growth.outreach_jobs where id=${job.id}`;
    assert.deepEqual(retry, {
      status: "pending",
      reason: "reply_coverage_unknown",
      future: true,
    });
    await admin`update growth.outreach_jobs set status='leased',lease_owner='crashed',lease_until=clock_timestamp()-interval '1 second',due_at=clock_timestamp()-interval '1 minute' where id=${job.id}`;
    const recovered = await claimFollowUps(db, {
      connectionId: input.connectionId,
      workerId: "recovery-test",
      limit: 1,
    });
    assert.equal(recovered[0]?.id, job.id);
    assert.notEqual(recovered[0]?.revision, item.revision);
    assert.ok(recovered[0]);
    assert.equal(
      await settleFollowUp(db, {
        ...attempt,
        leaseOwner: "recovery-test",
        leaseRevision: recovered[0].revision,
        reason: "preparation_not_authorized",
      }),
      "held",
    );
    const [held] = await admin<
      { status: string; reason: string }[]
    >`select status,last_error_code as reason from growth.outreach_jobs where id=${job.id}`;
    assert.deepEqual(held, {
      status: "held",
      reason: "preparation_not_authorized",
    });
  } finally {
    await admin`update growth.outreach_jobs set status='leased',lease_owner='test-follow-up',lease_revision=lease_revision+1,lease_until=clock_timestamp()+interval '5 minutes',due_at=${job.dueAt},last_error_code=null where id=${job.id}`;
  }
}
