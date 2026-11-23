import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import type { GrowthDb, GrowthTransaction } from "../../../lib/growth/db/types";
import { executeCampaignCommand } from "../../../lib/growth/campaigns/commands";
import { campaignPolicyDefinitionSchema } from "../../../lib/growth/campaigns/schemas";
import { serializeCampaignDefinition } from "../../../lib/growth/campaigns/lifecycle";
import { runFirstPreparationBatch } from "../../../lib/growth/campaigns/first-preparation-worker";
import { loadCanonicalOutreachPreparation } from "../../../lib/growth/campaigns/dispatch-authority";
import { loadControlledPreparation } from "../../../lib/growth/campaigns/controlled-preparation";
import {
  beginResendOutreachSubmission,
  reserveResendOutreachAttempt,
} from "../../../lib/growth/campaigns/resend-reservation-repository";
import { submitReservedResendOutreach } from "../../../lib/growth/campaigns/resend-direct-submission";
import { createResendOutreachTransport } from "../../../lib/growth/integrations/resend/outreach-transport";
import { postgresSequenceDispatchRepository } from "../../../lib/growth/sequences/dispatcher-repository";
import { loadReviewMembershipPreparationAuthority } from "../../../lib/growth/campaigns/founder-verification-reader";
import { ingestResearchRun } from "../../../lib/growth/research/ingest";
import { createGlobalResearchFixture } from "../../../lib/growth/research/global-test-fixture";
import { globalResearchRunSchema } from "../../../lib/growth/research/global-schema";

const url = process.env.DIRECT_DATABASE_URL;
for (const scenario of ["accepted", "unknown", "not_invoked"] as const)
  test(
    `Resend guarded preparation and ${scenario} evidence`,
    { skip: !url },
    async () => {
      if (!url) return;
      const sql = postgres(url, { max: 1 });
      const rollback = new Error("rollback fixture");
      const runtimeKeys = [
        "RESEND_OUTREACH_FROM_EMAIL",
        "RESEND_OUTREACH_REPLY_TO_EMAIL",
        "RESEND_OUTREACH_TEAM",
        "RESEND_OUTREACH_ENVIRONMENT",
        "RESEND_OUTREACH_SEND_GENERATION",
        "RESEND_OUTREACH_USAGE_GENERATION",
        "RESEND_OUTREACH_SEND_API_KEY",
        "RESEND_OUTREACH_USAGE_API_KEY",
      ] as const;
      const originalEnv = Object.fromEntries(
        runtimeKeys.map((key) => [key, process.env[key]]),
      );
      try {
        await assert.rejects(
          sql.begin(async (tx) => {
            const db = Object.assign(tx, {
              begin: async <T>(f: (t: GrowthTransaction) => Promise<T>) =>
                f(tx),
            }) as unknown as GrowthDb;
            const founder = {
              email: "j.ntagengwa@faithfulsoftware.dev",
              actorId: createHash("sha256")
                .update("j.ntagengwa@faithfulsoftware.dev")
                .digest("hex"),
            };
            const id = randomUUID(),
              campaignId = randomUUID(),
              gmail = randomUUID(),
              review = randomUUID(),
              healthReview = randomUUID();
            const sender = `outreach@${randomUUID()}.example.test`;
            const binding = {
              team: `team-${id}`,
              environment: "development" as const,
              sender,
              domain: sender.split("@")[1]!,
              replyTo: sender,
              sendGeneration: randomUUID(),
              usageGeneration: randomUUID(),
            };
            const runtime = {
              binding,
              sendCredential: "test-send",
              usageCredential: "test-usage",
            };
            Object.assign(process.env, {
              RESEND_OUTREACH_FROM_EMAIL: sender,
              RESEND_OUTREACH_REPLY_TO_EMAIL: sender,
              RESEND_OUTREACH_TEAM: binding.team,
              RESEND_OUTREACH_ENVIRONMENT: binding.environment,
              RESEND_OUTREACH_SEND_GENERATION: binding.sendGeneration,
              RESEND_OUTREACH_USAGE_GENERATION: binding.usageGeneration,
              RESEND_OUTREACH_SEND_API_KEY: runtime.sendCredential,
              RESEND_OUTREACH_USAGE_API_KEY: runtime.usageCredential,
            });
            const now = Date.now();
            const health = {
              source: "test",
              observedFrom: new Date(now - 20000),
              observedUntil: new Date(now - 10000),
              expiresAt: new Date(now + 60000),
              complete: true,
              verdict: "healthy",
              sends: 100,
              attempts: 100,
              hardBounces: 0,
              complaints: 0,
              rateIncidents: 0,
              authIncidents: 0,
              authentication: {
                spf: { status: "pass", source: "test" },
                dkim: { status: "pass", source: "test" },
                dmarc: { status: "pass", source: "test" },
              },
            };
            const window = {
              used: 1,
              sent: 1,
              received: 0,
              limit: 100,
              resets_at: new Date(now + 3600000).toISOString(),
            };
            const usage = {
              observedAt: new Date(now - 1000).toISOString(),
              validUntil: new Date(now + 60000).toISOString(),
              daily: window,
              monthly: window,
              rateLimit: { limit: 1, duration: "1000ms" },
            };
            await tx`insert into growth.integration_connections(id,provider,subject_email,status,google_subject,granted_scopes) values (${gmail},'gmail',${sender},'connected','test-subject',${["openid", "email", "https://www.googleapis.com/auth/gmail.modify"]})`;
            await tx`insert into growth.integration_connections(id,provider,subject_email) values (${id},'resend',${sender})`;
            await tx`insert into growth.outreach_account_controls(connection_id,provider,state,verified_subject,verified_grant_epoch,verified_scopes,resend_team,resend_environment,resend_binding) values (${id},'resend','active',null,null,null,${binding.team},${binding.environment},${tx.json(binding)})`;
            await tx`insert into growth.outreach_account_reviews(id,connection_id,request_id,request_hash,actor_id,kind,evidence,resulting_version) values (${review},${id},${randomUUID()},repeat('a',64),${founder.actorId},'resend_configure',${tx.json({ binding })},2), (${healthReview},${id},${randomUUID()},repeat('b',64),${founder.actorId},'record_health',${tx.json({ evidence: health })},3)`;
            await tx`update growth.outreach_account_controls set resend_binding_review_id=${review},health_review_id=${healthReview} where connection_id=${id}`;
            await tx`insert into growth.outreach_provider_usage(account_id,connection_id,complete,health,resend_usage,resend_usage_generation) values (${id},${id},true,'healthy',${tx.json(usage)},${binding.usageGeneration})`;
            const attestation = {
              summary: "reviewed",
              reference: { kind: "private" as const, value: "review" },
              observedAt: new Date(now - 1000),
              expiresAt: new Date(now + 3600000),
            };
            const policy = campaignPolicyDefinitionSchema.parse({
              version: 1,
              accountConnectionId: id,
              effectiveAt: new Date(now - 1000),
              expiresAt: new Date(now + 3600000),
              offer: "review",
              capabilityEvidence: "review",
              jurisdiction: "GB",
              provider: "resend",
              permissionRequirement: "consent",
              haltThresholds: { hardBounces: 1, complaints: 1 },
              variants: [
                { id: "a", version: 1, cta: "May I?" },
                { id: "b", version: 1, cta: "Could I?" },
              ],
              cadenceFamily: "review",
              recipientTimezone: "Europe/London",
              windowStart: "00:00",
              windowEnd: "23:59",
              sendWeekdays: [1, 2, 3, 4, 5, 6, 7],
              capabilityAttestation: attestation,
              providerAttestation: {
                ...attestation,
                provider: "resend",
                jurisdiction: "GB",
                confirmed: true,
              },
            });
            await tx`insert into growth.campaigns(id,version,request_id,name,policy,account_connection_id,status,approved_by,approved_at) values (${campaignId},1,${randomUUID()},'Resend fixture',${tx.json(serializeCampaignDefinition(policy))},${id},'approved',${founder.actorId},now())`;
            const fixture = createGlobalResearchFixture();
            const candidate = fixture.prospects[0];
            if (!candidate?.evidence[0]) throw new Error("fixture missing");
            const unique = randomUUID(),
              source = `https://${unique}.example.test/contact`,
              email = `office@${unique}.example.test`,
              when = new Date(now - 60000).toISOString();
            const evidence = {
              ...candidate.evidence[0],
              sourceUrl: source,
              observedAt: when,
              verifiedAt: when,
            };
            const run = globalResearchRunSchema.parse({
              ...fixture,
              externalRunId: unique,
              prospects: [
                {
                  ...candidate,
                  business: {
                    ...candidate.business,
                    countryCode: "GB",
                    websiteUrl: source,
                    firstPartySourceUrl: source,
                    verifiedAt: when,
                  },
                  contact: {
                    ...candidate.contact,
                    email,
                    emailSourceUrl: source,
                    emailVerifiedAt: when,
                  },
                  evidence: [
                    { ...evidence, claimType: "contact_email" },
                    {
                      ...evidence,
                      claimType: "business_observation",
                      claimSummary:
                        "Customers request appointments by telephone.",
                    },
                  ],
                  proof: {
                    purpose: "campaign_source_proof",
                    contactEmail: { evidenceIndex: 0, email },
                    businessObservation: { evidenceIndex: 1 },
                  },
                },
              ],
            });
            const ingested = await ingestResearchRun(db, run, {
              kind: "signed_research",
              keyId: "test-agent",
              bodySha256: "a".repeat(64),
            });
            const prospectId = ingested.acceptedProspects[0]?.prospectId;
            assert.ok(prospectId);
            const [proof] = await tx<
              { id: string }[]
            >`select id from growth.research_source_proof_bindings where research_run_id=${ingested.runId} and prospect_id=${prospectId}`;
            assert.ok(proof);
            const member = await executeCampaignCommand(
              db,
              {
                type: "enrol",
                requestId: randomUUID(),
                campaignId,
                policyVersion: 1,
                prospectId,
              },
              founder,
              randomUUID(),
            );
            const eventId = randomUUID(),
              permissionId = randomUUID();
            await executeCampaignCommand(
              db,
              {
                type: "record_permission",
                requestId: eventId,
                membershipId: member.id,
                evidenceId: permissionId,
                basis: "consent",
                provider: "resend",
                jurisdiction: "GB",
                expiresAt: new Date(now + 3600000),
                observedAt: new Date(now - 1000),
                explicitOptIn: true,
                summary: "Recipient opted in.",
                reference: { kind: "private", value: "record" },
                expectedProspectVersion: 1,
                expectedContactVersion: 1,
                researchProofId: proof.id,
              },
              founder,
              randomUUID(),
            );
            const sourceInput = {
              membershipId: member.id,
              connectionId: id,
              source: { kind: "permission_event" as const, eventId },
              resendRuntime: runtime,
            };
            assert.ok(
              await loadReviewMembershipPreparationAuthority(tx, sourceInput),
            );
            assert.equal(
              await loadReviewMembershipPreparationAuthority(tx, {
                ...sourceInput,
                resendRuntime: {
                  ...runtime,
                  binding: { ...binding, sendGeneration: randomUUID() },
                },
              }),
              null,
            );
            await tx`update growth.outreach_permissions set evidence=jsonb_set(evidence,'{explicitOptIn}','false'::jsonb) where id=${permissionId}`;
            assert.equal(
              await loadReviewMembershipPreparationAuthority(tx, sourceInput),
              null,
            );
            await tx`update growth.outreach_permissions set evidence=jsonb_set(evidence,'{explicitOptIn}','true'::jsonb) where id=${permissionId}`;
            await tx`insert into growth.suppressions(normalised_email,reason,source,created_by) values (${email},'opt_out','manual','test')`;
            assert.equal(
              await loadReviewMembershipPreparationAuthority(tx, sourceInput),
              null,
            );
            await tx`delete from growth.suppressions where normalised_email=${email}`;
            const organisationId = randomUUID();
            await tx`insert into operations.organisations(id,legal_name,display_name,trading_status,timezone,created_by,review_reference)
            select ${organisationId},b.legal_name,b.legal_name,'active','Europe/London',${founder.actorId},'synthetic'
            from growth.prospects p join growth.businesses b on b.id=p.business_id where p.id=${prospectId}`;
            assert.equal(
              await loadReviewMembershipPreparationAuthority(tx, sourceInput),
              null,
            );
            await tx`delete from operations.audit_events where organisation_id=${organisationId}`;
            await tx`delete from operations.organisations where id=${organisationId}`;
            await tx`update growth.prospects set version=version+1 where id=${prospectId}`;
            assert.equal(
              await loadReviewMembershipPreparationAuthority(tx, sourceInput),
              null,
            );
            await tx`update growth.prospects set version=version-1 where id=${prospectId}`;
            await tx`set local role growth_app`;
            const result = await runFirstPreparationBatch(db, {
              workerId: "test-worker",
              binding: { provider: "resend", connectionId: id, runtime },
            });
            assert.equal(result.prepared, 1);
            await tx`reset role`;
            const [prepared] = await tx<
              {
                id: string;
                sequenceId: string;
                channel: string;
                status: string;
                metadata: {
                  copyFamilyVersion: number;
                  copyFamilySha256: string;
                };
              }[]
            >`select em.id,em.sequence_enrollment_id as "sequenceId",em.channel,em.status,em.controlled_preparation as metadata from growth.campaign_memberships m join growth.email_messages em on em.sequence_enrollment_id=m.sequence_id where m.id=${member.id}`;
            assert.equal(prepared?.channel, "resend");
            assert.equal(prepared?.status, "queued");
            assert.equal(prepared?.metadata.copyFamilyVersion, 1);
            assert.match(
              prepared?.metadata.copyFamilySha256 ?? "",
              /^[a-f0-9]{64}$/,
            );
            assert.ok(prepared);
            const oldLease = randomUUID(),
              reservation = randomUUID();
            await tx`update growth.email_messages set status='sending',outreach_guarded_claim=true,outreach_claim_previous_status='queued',lease_token=${oldLease},lease_expires_at=clock_timestamp()-interval '1 minute',attempt_count=1 where id=${prepared.id}`;
            await tx`insert into growth.outreach_reservations(id,idempotency_key,campaign_id,policy_version,membership_id,email_message_id,sequence_id,account_id,london_day,connection_id,outreach_provider,resend_send_generation,recipient_count,authority_fingerprint,lease_token,lease_until,fence)
            values (${reservation},${randomUUID()},${campaignId},1,${member.id},${prepared.id},${prepared.sequenceId},${id},current_date,${id},'resend',${binding.sendGeneration},1,repeat('a',64),${oldLease},clock_timestamp()-interval '1 minute',1)`;
            const claimInput = {
              now: new Date(),
              leaseToken: randomUUID(),
              leaseExpiresAt: new Date(Date.now() + 60000),
              messageId: prepared.id,
            };
            assert.equal(
              await postgresSequenceDispatchRepository.claimDueMessage(
                db,
                claimInput,
              ),
              null,
            );
            const [untouched] = await tx<
              { status: string }[]
            >`select status from growth.outreach_reservations where id=${reservation}`;
            assert.equal(untouched?.status, "reserved");
            const claimed =
              await postgresSequenceDispatchRepository.claimDueMessage(db, {
                ...claimInput,
                channel: "resend",
              });
            assert.equal(claimed?.id, prepared.id);
            const [cancelled] = await tx<
              { status: string }[]
            >`select status from growth.outreach_reservations where id=${reservation}`;
            assert.equal(cancelled?.status, "cancelled");
            const canonical = await loadCanonicalOutreachPreparation(tx, {
              messageId: prepared.id,
              leaseToken: claimInput.leaseToken,
              connectionId: id,
              grantEpoch: null,
              now: new Date(),
              resendRuntime: runtime,
            });
            assert.equal(canonical.status, "ready");
            if (canonical.status !== "ready")
              throw new Error("canonical authority missing");
            const controlled = await loadControlledPreparation(tx, {
              membershipId: member.id,
              connectionId: id,
              preparation: canonical.preparation,
              resendRuntime: runtime,
            });
            assert.ok(controlled?.copyFamilySha256);
            const [permissionOutbox] = await tx<
              { id: string }[]
            >`select id from growth.outreach_outbox where event_id=${eventId}`;
            assert.ok(permissionOutbox);
            await tx`delete from growth.outreach_jobs where outbox_id=${permissionOutbox.id}`;
            await tx`delete from growth.outreach_outbox where id=${permissionOutbox.id}`;
            assert.equal(
              await loadControlledPreparation(tx, {
                membershipId: member.id,
                connectionId: id,
                preparation: canonical.preparation,
                resendRuntime: runtime,
              }),
              null,
            );
            await tx`insert into growth.outreach_outbox(id,event_id) values (${permissionOutbox.id},${eventId})`;
            await tx`update growth.outreach_permissions set evidence=jsonb_set(evidence,'{explicitOptIn}','false'::jsonb) where id=${permissionId}`;
            assert.equal(
              (
                await loadCanonicalOutreachPreparation(tx, {
                  messageId: prepared.id,
                  leaseToken: claimInput.leaseToken,
                  connectionId: id,
                  grantEpoch: null,
                  now: new Date(),
                  resendRuntime: runtime,
                })
              ).status,
              "held",
            );
            await tx`update growth.outreach_permissions set evidence=jsonb_set(evidence,'{explicitOptIn}','true'::jsonb) where id=${permissionId}`;
            const founderGmail = randomUUID(),
              limitsReview = randomUUID(),
              gmailHealthReview = randomUUID();
            const scopes = [
              "openid",
              "email",
              "https://www.googleapis.com/auth/gmail.modify",
            ];
            await tx`insert into growth.integration_connections(id,provider,subject_email,status,google_subject,granted_scopes) values (${founderGmail},'gmail',${founder.email},'connected','founder-subject',${scopes})`;
            await tx`insert into growth.outreach_account_controls(connection_id,provider,state,verified_subject,verified_grant_epoch,verified_scopes) values (${founderGmail},'gmail','active','founder-subject',1,${scopes})`;
            const limits = {
              source: "test",
              edition: "workspace",
              path: "gmail",
              observedAt: new Date(now - 1000),
              expiresAt: new Date(now + 3600000),
              messages: 500,
              recipients: [1000, 1000, 1000, 1000],
              perMessage: 100,
              messageReserve: 50,
              recipientReserve: 10,
              visibility: {
                source: "test",
                scope: "mailbox",
                reviewedAt: new Date(now - 1000),
                expiresAt: new Date(now + 3600000),
                paths: {
                  mailbox: "covered",
                  aliases: "covered",
                  delegates: "covered",
                  automatic: "covered",
                },
                recipientHeaders: "complete",
                supportedPaths: {
                  nativeMailbox: "included",
                  fssGmailApi: "included",
                  aliases: "none",
                  delegation: "none",
                  other: "none",
                },
              },
            };
            const envelope = {
              googleSubject: "founder-subject",
              googleScopes: scopes,
            };
            await tx`insert into growth.outreach_account_reviews(id,connection_id,request_id,request_hash,actor_id,kind,evidence,resulting_version) values (${limitsReview},${founderGmail},${randomUUID()},repeat('c',64),${founder.actorId},'record_limits',${tx.json({ ...envelope, evidence: limits })},2),(${gmailHealthReview},${founderGmail},${randomUUID()},repeat('d',64),${founder.actorId},'record_health',${tx.json({ ...envelope, evidence: health })},3)`;
            await tx`update growth.outreach_account_controls set limits_review_id=${limitsReview},health_review_id=${gmailHealthReview} where connection_id=${founderGmail}`;
            await tx`insert into growth.outreach_provider_usage(account_id,observed_at,rolling_messages,rolling_recipients,complete,health,connection_id,grant_epoch,captured_at,window_start,history_start,history_end,fresh_until,evidence_version,provider_message_ids,observation_subject,observation_scopes,observation_revision) values (${founderGmail},now(),0,0,true,'healthy',${founderGmail},1,now(),now()-interval '24 hours','100','200',now()+interval '1 minute',2,'[]'::jsonb,'founder-subject',${scopes},1)`;
            const invalidAttempt = {
              messageId: prepared.id,
              leaseToken: claimInput.leaseToken,
              attemptKey: `resend/${randomUUID()}`,
            };
            process.env.RESEND_OUTREACH_SEND_GENERATION = randomUUID();
            assert.equal(
              (await reserveResendOutreachAttempt(db, invalidAttempt)).status,
              "held",
            );
            process.env.RESEND_OUTREACH_SEND_GENERATION =
              binding.sendGeneration;
            await tx`update growth.outreach_provider_usage set resend_usage=${tx.json({ ...usage, daily: { ...window, used: 100, sent: 100 } })} where account_id=${id}`;
            assert.equal(
              (await reserveResendOutreachAttempt(db, invalidAttempt)).status,
              "held",
            );
            await tx`update growth.outreach_provider_usage set resend_usage=${tx.json(usage)} where account_id=${id}`;
            const reserved = await reserveResendOutreachAttempt(db, {
              messageId: prepared.id,
              leaseToken: claimInput.leaseToken,
              attemptKey: `resend/${randomUUID()}`,
            });
            assert.equal(
              reserved.status,
              "ready",
              reserved.status === "held" ? reserved.reason : undefined,
            );
            if (reserved.status !== "ready") throw new Error("reserve failed");
            const beginInput = {
              reservationId: reserved.value.reservationId,
              leaseToken: claimInput.leaseToken,
              fence: reserved.value.fence,
              fingerprint: reserved.value.preparation.fingerprint,
            };
            process.env.RESEND_OUTREACH_USAGE_GENERATION = randomUUID();
            assert.equal(
              (await beginResendOutreachSubmission(db, beginInput)).status,
              "held",
            );
            process.env.RESEND_OUTREACH_USAGE_GENERATION =
              binding.usageGeneration;
            await tx`update growth.outreach_permissions set evidence=jsonb_set(evidence,'{explicitOptIn}','false'::jsonb) where id=${permissionId}`;
            assert.equal(
              (await beginResendOutreachSubmission(db, beginInput)).status,
              "held",
            );
            await tx`update growth.outreach_permissions set evidence=jsonb_set(evidence,'{explicitOptIn}','true'::jsonb) where id=${permissionId}`;
            let posts = 0;
            const sendInput = {
              reservationId: reserved.value.reservationId,
              leaseToken: claimInput.leaseToken,
              fence: reserved.value.fence,
              fingerprint: reserved.value.preparation.fingerprint,
            };
            const factory = (credential: string) => {
              const transport = createResendOutreachTransport(credential, {
                request: async () => {
                  posts++;
                  if (scenario === "unknown")
                    throw new Error("synthetic response loss");
                  return Response.json({ id: "synthetic-message-id" });
                },
              });
              return scenario === "not_invoked"
                ? {
                    sendOnce: (
                      value: Parameters<typeof transport.sendOnce>[0],
                    ) => transport.sendOnce(value, () => false),
                  }
                : transport;
            };
            const submit = await submitReservedResendOutreach(
              db,
              sendInput,
              factory,
            );
            assert.equal(
              submit.status,
              scenario === "unknown" ? "uncertain" : scenario,
            );
            assert.equal(posts, scenario === "not_invoked" ? 0 : 1);
            const [receipt] = await tx<
              {
                status: string;
                confirmed: Date | null;
                providerId: string | null;
              }[]
            >`select status,confirmation_observed_at as confirmed,provider_message_id as "providerId" from growth.outreach_reservations where id=${reserved.value.reservationId}`;
            assert.deepEqual(receipt, {
              status:
                scenario === "unknown"
                  ? "uncertain"
                  : scenario === "not_invoked"
                    ? "rejected"
                    : "accepted",
              confirmed: null,
              providerId:
                scenario === "accepted" ? "synthetic-message-id" : null,
            });
            const repeated = await submitReservedResendOutreach(
              db,
              sendInput,
              factory,
            );
            assert.equal(repeated.status, "held");
            assert.equal(posts, scenario === "not_invoked" ? 0 : 1);
            throw rollback;
          }),
          (error) => error === rollback,
        );
      } finally {
        for (const key of runtimeKeys) {
          const value = originalEnv[key];
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
        await sql.end();
      }
    },
  );
