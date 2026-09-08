import assert from "node:assert/strict";
import test from "node:test";
import { signingFixture } from "./signing-fixtures";
import { completeAgreementSigning } from "../../../lib/operations/agreements/signing-worker";
import { runSigningGrowthWorker } from "../../../lib/operations/agreements/signing-growth";

test("durable signing completion wins negotiation once as system and stops active outreach", async (t) => {
  const f = await signingFixture(t, 1);
  await f.admin`update growth.delivery_engagements set stage='negotiation' where id=${f.record.engagementId}`;
  const [enrollment] = await f.admin<
    { id: string }[]
  >`insert into growth.sequence_enrollments(prospect_id,contact_id,status) values(${f.engagement.prospectId},${f.engagement.contactId},'active') returning id`;
  const p = await f.approve(await f.prepare());
  await f.sign(p);
  await completeAgreementSigning(f.worker, p.id, f.correlationId);
  assert.deepEqual(await runSigningGrowthWorker(f.worker, f.admin), {
    completed: 1,
    review: 0,
    failed: 0,
  });
  const [engagement] =
    await f.admin`select stage,version,one_off_value_pence,won_at from growth.delivery_engagements where id=${f.record.engagementId}`;
  assert.equal(engagement.stage, "won");
  assert.equal(engagement.version, 2);
  assert.equal(engagement.one_off_value_pence, 10000);
  const events =
    await f.admin`select actor_type,actor_id,reason_code from growth.commercial_stage_events where engagement_id=${f.record.engagementId}`;
  assert.equal(events.length, 1);
  assert.equal(events[0].actor_type, "system");
  assert.equal(events[0].actor_id, "operations-signing");
  assert.equal(events[0].reason_code, "agreement_signed");
  assert.equal(
    (
      await f.admin`select status from growth.sequence_enrollments where id=${enrollment.id}`
    )[0].status,
    "stopped_started_talks",
  );
  assert.deepEqual(await runSigningGrowthWorker(f.worker, f.admin), {
    completed: 0,
    review: 0,
    failed: 0,
  });
  assert.equal(
    (
      await f.admin`select version from growth.delivery_engagements where id=${f.record.engagementId}`
    )[0].version,
    2,
  );
});
for (const stage of ["won", "lost", "new"] as const)
  test(`completion preserves historical ${stage} engagement and routes unresolved state`, async (t) => {
    const f = await signingFixture(t, 1);
    if (stage === "won")
      await f.admin`update growth.delivery_engagements set stage='won',won_at='2026-01-01',one_off_value_pence=777 where id=${f.record.engagementId}`;
    if (stage === "lost")
      await f.admin`update growth.delivery_engagements set stage='lost',lost_at='2026-01-01',loss_reason='existing_history' where id=${f.record.engagementId}`;
    const p = await f.approve(await f.prepare());
    await f.sign(p);
    await completeAgreementSigning(f.worker, p.id, f.correlationId);
    const result = await runSigningGrowthWorker(f.worker, f.admin);
    assert.equal(stage === "won" ? result.completed : result.review, 1);
    const [engagement] =
      await f.admin`select stage,version,one_off_value_pence from growth.delivery_engagements where id=${f.record.engagementId}`;
    assert.equal(engagement.stage, stage);
    assert.equal(engagement.version, 1);
    if (stage === "won") assert.equal(engagement.one_off_value_pence, 777);
    assert.equal(
      (
        await f.admin`select id from growth.commercial_stage_events where engagement_id=${f.record.engagementId}`
      ).length,
      0,
    );
    const [outbox] =
      await f.admin`select state,failure_code from operations.signing_completion_outbox where id=${p.id}`;
    assert.equal(outbox.state, stage === "won" ? "completed" : "review");
  });
test("Growth outage retains durable completion and retries without duplicate signing", async (t) => {
  const f = await signingFixture(t, 1);
  await f.admin`update growth.delivery_engagements set stage='negotiation' where id=${f.record.engagementId}`;
  const p = await f.approve(await f.prepare());
  await f.sign(p);
  await completeAgreementSigning(f.worker, p.id, f.correlationId);
  // The isolated signing role has no Growth access and reproduces a failed bridge.
  assert.deepEqual(await runSigningGrowthWorker(f.worker, f.worker), {
    completed: 0,
    review: 0,
    failed: 1,
  });
  const [failed] =
    await f.admin`select state,failure_code from operations.signing_completion_outbox where id=${p.id}`;
  assert.equal(failed.state, "pending");
  assert.equal(failed.failure_code, "growth_unavailable");
  await f.worker`update operations.signing_completion_outbox set next_attempt_at=now() where id=${p.id}`;
  assert.deepEqual(await runSigningGrowthWorker(f.worker, f.admin), {
    completed: 1,
    review: 0,
    failed: 0,
  });
  assert.equal(
    (
      await f.admin`select id from operations.signature_evidence where agreement_id=${f.record.id}`
    ).length,
    1,
  );
  await assert.rejects(
    f.worker`update operations.signing_completion_outbox set financial_snapshot='{}' where id=${p.id}`,
    { code: "42501" },
  );
});
