import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { GrowthDb, GrowthTransaction } from "../../../lib/growth/db/types";
import { classifyGmailRouting } from "../../../lib/growth/sequences/gmail-routing-repository";
import { postgresGmailSyncRepository } from "../../../lib/growth/sequences/gmail-sync-repository";

export async function exerciseExactResendReply(
  tx: GrowthTransaction,
  db: GrowthDb,
  input: {
    reservationId: string;
    connectionId: string;
    monitorId: string;
    sequenceId: string;
    messageId: string;
    prospectId: string;
    contactId: string;
    recipient: string;
    sendGeneration: string;
  },
): Promise<void> {
  const [submitted] = await tx<
    { at: Date }[]
  >`select submitted_at as at from growth.outreach_reservations where id=${input.reservationId}`;
  assert.ok(submitted);
  const observedAt = new Date(Date.now() + 1000).toISOString();
  const rfc = `<resend-${randomUUID()}@example.test>`,
    eventId = `event-${randomUUID()}`,
    webhookGeneration = randomUUID(),
    bodyHash = "d".repeat(64);
  const receipt = {
    basis: "resend_fss_delivery_observed",
    providerMessageId: "synthetic-message-id",
    providerEventId: eventId,
    bodySha256: bodyHash,
    rfcMessageId: rfc,
    connectionId: input.connectionId,
    webhookGeneration,
    sendGeneration: input.sendGeneration,
    providerEventCreatedAt: observedAt,
    providerMessageCreatedAt: null,
    observedAt,
    possibleInvocationFrom: submitted.at.toISOString(),
  };
  await tx`insert into growth.resend_delivery_events(provider_event_id,event_type,occurred_at,recipient_normalised_email,email_message_id,sanitised_payload,outreach_reservation_id,outreach_connection_id,outreach_webhook_generation,outreach_body_sha256,outreach_rfc_message_id) values (${eventId},'email.delivered',${observedAt}::timestamptz,${input.recipient},${input.messageId},'{}'::jsonb,${input.reservationId},${input.connectionId},${webhookGeneration},${bodyHash},${rfc})`;
  await tx`update growth.outreach_reservations set confirmation_receipt=${tx.json(receipt)},confirmation_observed_at=${observedAt}::timestamptz where id=${input.reservationId}`;
  await tx`update growth.email_messages set provider_message_id='synthetic-message-id',rfc_message_id=${rfc} where id=${input.messageId}`;
  const binding = {
    connectionId: input.monitorId,
    googleSubject: "test-subject",
    grantEpoch: 1,
    grantedScopes: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/gmail.modify",
    ],
  };
  const threadId = `new-thread-${randomUUID()}`,
    messageId = `gmail-${randomUUID()}`;
  const observation = {
    messageId,
    historyId: "200",
    threadId,
    inReplyTo: rfc,
    references: null,
    fromAddress: input.recipient,
    fromHeader: `Owner <${input.recipient}>`,
  };
  const match = await classifyGmailRouting(db, { ...observation, binding });
  assert.equal(match.kind, "unique");
  if (match.kind !== "unique")
    throw new Error("exact reply was not attributed");
  assert.equal(match.enrollment.id, input.sequenceId);
  assert.ok(match.attribution);
  const exactAttribution = match.attribution;
  assert.equal(match.attribution.reservationId, input.reservationId);
  assert.equal(match.attribution?.outboundProvider, "resend");
  const crossed = await classifyGmailRouting(db, {
    ...observation,
    fromHeader: "Other <other@example.test>",
    fromAddress: "other@example.test",
    binding,
  });
  assert.notEqual(crossed.kind, "unique");
  const stripped = await classifyGmailRouting(db, {
    ...observation,
    inReplyTo: null,
    binding,
  });
  assert.notEqual(stripped.kind, "unique");
  const malformed = await classifyGmailRouting(db, {
    ...observation,
    references: "invalid",
    binding,
  });
  assert.equal(malformed.kind, "uncertain");
  await tx`update growth.integration_connections set subject_email=${`changed-${randomUUID()}@example.test`} where id=${input.monitorId}`;
  assert.notEqual(
    (await classifyGmailRouting(db, { ...observation, binding })).kind,
    "unique",
  );
  const [frozenAddress] = await tx<
    { address: string }[]
  >`select issued_snapshot->'monitoredMailbox'->>'address' as address from growth.outreach_reservations where id=${input.reservationId}`;
  assert.ok(frozenAddress);
  await tx`update growth.integration_connections set subject_email=${frozenAddress.address} where id=${input.monitorId}`;
  const foreignId = randomUUID();
  await tx`insert into growth.integration_connections(id,provider,subject_email,status,google_subject,granted_scopes) values (${foreignId},'gmail',${`foreign-${randomUUID()}@example.test`},'connected','test-subject',${binding.grantedScopes})`;
  assert.notEqual(
    (
      await classifyGmailRouting(db, {
        ...observation,
        binding: { ...binding, connectionId: foreignId },
      })
    ).kind,
    "unique",
  );
  await tx`delete from growth.integration_connections where id=${foreignId}`;
  await tx`update growth.integration_connections set status='revoked' where id=${input.monitorId}`;
  await assert.rejects(
    classifyGmailRouting(db, { ...observation, binding }),
    /Gmail grant changed/,
  );
  await tx`update growth.integration_connections set status='connected' where id=${input.monitorId}`;
  const foreign = { ...binding, grantEpoch: 2 };
  await assert.rejects(
    classifyGmailRouting(db, { ...observation, binding: foreign }),
    /Gmail grant changed/,
  );
  const conflictingId = randomUUID(),
    conflictingRfc = `<conflict-${randomUUID()}@example.test>`;
  await tx`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,rfc_message_id) values (${conflictingId},${input.sequenceId},${input.prospectId},${input.contactId},'gmail','outbound',4,'draft',${randomUUID()},${conflictingRfc})`;
  assert.equal(
    (
      await classifyGmailRouting(db, {
        ...observation,
        references: conflictingRfc,
        binding,
      })
    ).kind,
    "ambiguous",
  );
  await tx`delete from growth.email_messages where id=${conflictingId}`;
  const record = {
    binding,
    sequenceEnrollmentId: input.sequenceId,
    prospectId: input.prospectId,
    contactId: input.contactId,
    gmailMessageId: messageId,
    gmailThreadId: threadId,
    observation,
    rfcMessageId: `<inbound-${randomUUID()}@example.test>`,
    from: observation.fromHeader,
    subject: "A reply",
    receivedAt: new Date(),
    eventType: "reply" as const,
    correlationId: randomUUID(),
  };
  const result = await postgresGmailSyncRepository.recordInboundEvent(
    db,
    record,
  );
  assert.equal(result.alreadyRecorded, false);
  const [written] = await tx<
    { status: string; attribution: unknown; reservationId: string | null }[]
  >`select se.status,e.outreach_reply_attribution as attribution,e.outreach_reply_reservation_id as "reservationId" from growth.sequence_enrollments se join growth.email_messages em on em.sequence_enrollment_id=se.id and em.provider_message_id=${messageId} join growth.email_events e on e.email_message_id=em.id where se.id=${input.sequenceId}`;
  assert.equal(written?.status, "stopped_reply");
  assert.equal(written?.reservationId, input.reservationId);
  assert.deepEqual(written?.attribution, match.attribution);
  await assert.rejects(
    tx.savepoint(async (sp) => {
      await sp`update growth.email_events set outreach_reply_attribution='{}'::jsonb where outreach_reply_reservation_id=${input.reservationId}`;
    }),
    /immutable/,
  );
  await assert.rejects(
    tx.savepoint(async (sp) => {
      await sp`update growth.email_events set event_type='auto_response' where outreach_reply_reservation_id=${input.reservationId}`;
    }),
    /immutable/,
  );
  const historicalEvent = randomUUID();
  await tx`insert into growth.email_events(id,email_message_id,provider,provider_event_id,event_type,occurred_at) select ${historicalEvent},email_message_id,'gmail',${`legacy-${randomUUID()}`},'reply',now() from growth.email_events where outreach_reply_reservation_id=${input.reservationId}`;
  await assert.rejects(
    tx.savepoint(async (sp) => {
      await sp`update growth.email_events set outreach_reply_reservation_id=${input.reservationId},outreach_reply_attribution=${sp.json(exactAttribution)} where id=${historicalEvent}`;
    }),
    /immutable/,
  );
  assert.equal(
    (await postgresGmailSyncRepository.recordInboundEvent(db, record))
      .alreadyRecorded,
    true,
  );
}
