import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import type { GrowthDb, GrowthTransaction } from "../../../lib/growth/db/types";
import { executeCampaignCommand } from "../../../lib/growth/campaigns/commands";
import { campaignPolicyDefinitionSchema } from "../../../lib/growth/campaigns/schemas";
import { serializeCampaignDefinition } from "../../../lib/growth/campaigns/lifecycle";
import { runFirstPreparationBatch } from "../../../lib/growth/campaigns/first-preparation-worker";
import { loadReviewMembershipPreparationAuthority } from "../../../lib/growth/campaigns/founder-verification-reader";
import { ingestResearchRun } from "../../../lib/growth/research/ingest";
import { createGlobalResearchFixture } from "../../../lib/growth/research/global-test-fixture";
import { globalResearchRunSchema } from "../../../lib/growth/research/global-schema";

const url = process.env.DIRECT_DATABASE_URL;
test(
  "Resend first preparation requires a current real account and consent event",
  { skip: !url },
  async () => {
    if (!url) return;
    const sql = postgres(url, { max: 1 });
    const rollback = new Error("rollback fixture");
    try {
      await assert.rejects(
        sql.begin(async (tx) => {
          const db = Object.assign(tx, {
            begin: async <T>(f: (t: GrowthTransaction) => Promise<T>) => f(tx),
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
            { channel: string; status: string }[]
          >`select em.channel,em.status from growth.campaign_memberships m join growth.email_messages em on em.sequence_enrollment_id=m.sequence_id where m.id=${member.id}`;
          assert.deepEqual(prepared, { channel: "resend", status: "queued" });
          throw rollback;
        }),
        (error) => error === rollback,
      );
    } finally {
      await sql.end();
    }
  },
);
