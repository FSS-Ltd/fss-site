import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { FounderSession } from "../../../lib/growth/auth/require-founder";
import type { GrowthDb } from "../../../lib/growth/db/types";
import { executeCampaignCommand } from "../../../lib/growth/campaigns/commands";

export async function exerciseCampaignReplyReview(
  admin: GrowthDb,
  db: GrowthDb,
  input: {
    membershipId: string;
    sequenceId: string;
    prospectId: string;
    contactId: string;
    founder: FounderSession;
  },
): Promise<void> {
  const [versions] = await admin<
    { policy: number; prospect: number; contact: number }[]
  >`
    select m.policy_version as policy,p.version as prospect,c.version as contact
    from growth.campaign_memberships m join growth.prospects p on p.id=m.prospect_id
    join growth.contacts c on c.id=p.primary_contact_id where m.id=${input.membershipId}`;
  assert.ok(versions);
  const messages = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const eventIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const requests: string[] = [];
  try {
    for (let index = 0; index < messages.length; index++) {
      const providerId = `synthetic-reply-${messages[index]}`;
      await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,provider_message_id,provider_thread_id,idempotency_key,received_at)
        values (${messages[index]},${input.sequenceId},${input.prospectId},${input.contactId},'gmail','inbound',0,'received',${providerId},${index === 3 ? "wrong-thread" : "confirmed-thread"},${`review-${messages[index]}`},clock_timestamp()-interval '1 minute')`;
      await admin`insert into growth.email_events(id,email_message_id,provider,provider_event_id,event_type,occurred_at)
        values (${eventIds[index]},${messages[index]},'gmail',${providerId},${index === 0 ? "auto_response" : "reply"},clock_timestamp()-interval '1 minute')`;
    }
    const base = {
      type: "record_reply" as const,
      membershipId: input.membershipId,
      inboundMessageId: messages[0],
      expectedPolicyVersion: versions.policy,
      expectedProspectVersion: versions.prospect,
      expectedContactVersion: versions.contact,
      kind: "bot" as const,
      requestId: randomUUID(),
    };
    requests.push(base.requestId);
    await assert.rejects(
      executeCampaignCommand(
        db,
        {
          ...base,
          requestId: randomUUID(),
          expectedContactVersion: versions.contact + 1,
        },
        input.founder,
        randomUUID(),
      ),
      /review_context_changed/,
    );
    await assert.rejects(
      executeCampaignCommand(
        db,
        { ...base, requestId: randomUUID(), inboundMessageId: randomUUID() },
        input.founder,
        randomUUID(),
      ),
      /reply_evidence_unavailable/,
    );
    await assert.rejects(
      executeCampaignCommand(
        db,
        { ...base, requestId: randomUUID(), inboundMessageId: messages[3] },
        input.founder,
        randomUUID(),
      ),
      /reply_evidence_unavailable/,
    );
    const competingSequence = randomUUID();
    await admin`insert into growth.sequence_enrollments(id,prospect_id,contact_id,status,gmail_thread_id) values (${competingSequence},${input.prospectId},${input.contactId},'completed','confirmed-thread')`;
    try {
      await assert.rejects(
        executeCampaignCommand(
          db,
          { ...base, requestId: randomUUID() },
          input.founder,
          randomUUID(),
        ),
        /reply_evidence_ambiguous/,
      );
    } finally {
      await admin`delete from growth.sequence_enrollments where id=${competingSequence}`;
    }
    const [binding] = await admin<{ id: string; subject: string }[]>`
      select c.account_connection_id as id,ctrl.verified_subject as subject
      from growth.campaign_memberships m join growth.campaigns c on c.id=m.campaign_id and c.version=m.policy_version
      join growth.outreach_account_controls ctrl on ctrl.connection_id=c.account_connection_id where m.id=${input.membershipId}`;
    assert.ok(binding);
    await admin`update growth.outreach_account_controls set verified_subject='replaced-subject' where connection_id=${binding.id}`;
    try {
      await assert.rejects(
        executeCampaignCommand(
          db,
          { ...base, requestId: randomUUID() },
          input.founder,
          randomUUID(),
        ),
        /review_context_changed/,
      );
    } finally {
      await admin`update growth.outreach_account_controls set verified_subject=${binding.subject} where connection_id=${binding.id}`;
    }
    const failureId = "ab8fbb5d-6b85-482b-b734-73943183bf02";
    await admin`alter table growth.audit_log add constraint test_reply_review_rollback check (correlation_id <> 'ab8fbb5d-6b85-482b-b734-73943183bf02') not valid`;
    try {
      await assert.rejects(
        executeCampaignCommand(
          db,
          { ...base, requestId: failureId },
          input.founder,
          failureId,
        ),
      );
      const [rolledBack] = await admin<{ count: number }[]>`
        select count(*)::int as count from growth.outreach_events where request_id=${failureId}`;
      assert.equal(rolledBack.count, 0);
    } finally {
      await admin`alter table growth.audit_log drop constraint test_reply_review_rollback`;
    }
    await assert.rejects(
      executeCampaignCommand(
        db,
        base,
        { email: "other@example.test", actorId: "0".repeat(64) },
        base.requestId,
      ),
      /founder_authorization_required/,
    );
    const [grant] = await admin<
      { version: number }[]
    >`select version from growth.integration_connections where id=${binding.id}`;
    assert.ok(grant);
    await admin`update growth.integration_connections set version=version+1 where id=${binding.id}`;
    const result = await (async () => {
      try {
        return await executeCampaignCommand(
          db,
          base,
          input.founder,
          base.requestId,
        );
      } finally {
        await admin`update growth.integration_connections set version=${grant.version} where id=${binding.id}`;
      }
    })();
    const replay = await executeCampaignCommand(
      db,
      base,
      input.founder,
      randomUUID(),
    );
    assert.equal(result.id, messages[0]);
    assert.equal(replay.alreadyExisted, true);
    await assert.rejects(
      executeCampaignCommand(
        db,
        { ...base, kind: "positive" },
        input.founder,
        randomUUID(),
      ),
      /request_conflict/,
    );
    await assert.rejects(
      executeCampaignCommand(
        db,
        { ...base, requestId: randomUUID(), kind: "positive" },
        input.founder,
        randomUUID(),
      ),
      /reply_evidence_unavailable/,
    );
    const [before] = await admin<
      { status: string }[]
    >`select status from growth.sequence_enrollments where id=${input.sequenceId}`;
    assert.equal(before.status, "active");
    const positive = {
      ...base,
      requestId: randomUUID(),
      inboundMessageId: messages[1],
      kind: "positive" as const,
    };
    requests.push(positive.requestId);
    await executeCampaignCommand(
      db,
      positive,
      input.founder,
      positive.requestId,
    );
    const [state] = await admin<
      { status: string; membership: string }[]
    >`select se.status,m.status as membership from growth.sequence_enrollments se join growth.campaign_memberships m on m.sequence_id=se.id where m.id=${input.membershipId}`;
    assert.equal(state.status, "stopped_reply");
    assert.equal(state.membership, "replied");
    const [evidence] = await admin<
      { kind: string; occurred: Date; received: Date }[]
    >`
      select e.review_reply_kind as kind,e.occurred_at as occurred,em.received_at as received
      from growth.outreach_events e join growth.email_messages em on em.id=e.review_inbound_message_id
      where e.request_id=${positive.requestId}`;
    assert.equal(evidence.kind, "positive");
    assert.ok(evidence.occurred >= evidence.received);
    const optout = {
      ...base,
      requestId: randomUUID(),
      inboundMessageId: messages[2],
      kind: "opt_out" as const,
    };
    requests.push(optout.requestId);
    await executeCampaignCommand(db, optout, input.founder, optout.requestId);
    const [suppression] = await admin<
      { count: number }[]
    >`select count(*)::int as count from growth.suppressions where business_id=(select business_id from growth.campaign_memberships where id=${input.membershipId})`;
    assert.equal(suppression.count, 1);
  } finally {
    await admin`delete from growth.suppressions where business_id=(select business_id from growth.campaign_memberships where id=${input.membershipId}) and source='founder'`;
    await admin`delete from growth.outreach_outbox where event_id=any(${admin.array(requests)}::uuid[])`;
    await admin`delete from growth.outreach_events where request_id=any(${admin.array(requests)}::uuid[])`;
    await admin`delete from growth.email_events where id=any(${admin.array(eventIds)}::uuid[])`;
    await admin`delete from growth.email_messages where id=any(${admin.array(messages)}::uuid[])`;
    await admin`delete from growth.audit_log where correlation_id=any(${admin.array(requests)}::text[])`;
  }
}
