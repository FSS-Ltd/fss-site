import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { FounderSession } from "../../../lib/growth/auth/require-founder";
import type { GrowthDb } from "../../../lib/growth/db/types";
import { withGrowthTransaction } from "../../../lib/growth/db/client";
import { executeCampaignCommand } from "../../../lib/growth/campaigns/commands";
import { loadReviewMembershipPreparationAuthority } from "../../../lib/growth/campaigns/founder-verification-reader";
import { ingestResearchRun } from "../../../lib/growth/research/ingest";
import { createGlobalResearchFixture } from "../../../lib/growth/research/global-test-fixture";
import { globalResearchRunSchema } from "../../../lib/growth/research/global-schema";

export async function exerciseResearchPreparation(
  admin: GrowthDb,
  db: GrowthDb,
  input: { campaignId: string; connectionId: string; founder: FounderSession },
): Promise<void> {
  const fixture = createGlobalResearchFixture();
  const candidate = fixture.prospects[0];
  if (!candidate || !candidate.evidence[0])
    throw new Error("Missing fixture evidence.");
  const id = randomUUID();
  const url = `https://${id}.example.test/contact`;
  const email = `${id}@example.test`;
  const when = new Date(Date.now() - 60000).toISOString();
  const evidence = {
    ...candidate.evidence[0],
    sourceUrl: url,
    observedAt: when,
    verifiedAt: when,
  };
  const run = globalResearchRunSchema.parse({
    ...fixture,
    externalRunId: id,
    prospects: [
      {
        ...candidate,
        business: {
          ...candidate.business,
          countryCode: "GB",
          websiteUrl: url,
          firstPartySourceUrl: url,
          verifiedAt: when,
        },
        contact: {
          ...candidate.contact,
          email,
          emailSourceUrl: url,
          emailVerifiedAt: when,
        },
        evidence: [
          { ...evidence, claimType: "contact_email" },
          {
            ...evidence,
            claimType: "business_observation",
            claimSummary: "Customers request appointments by telephone.",
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
  if (!prospectId) throw new Error("Research candidate was not accepted.");
  const [binding] = await db<
    { id: string }[]
  >`select id from growth.research_source_proof_bindings where research_run_id=${ingested.runId} and prospect_id=${prospectId}`;
  if (!binding) throw new Error("Research binding missing.");
  const member = await executeCampaignCommand(
    db,
    {
      type: "enrol",
      requestId: randomUUID(),
      campaignId: input.campaignId,
      policyVersion: 2,
      prospectId,
    },
    input.founder,
    randomUUID(),
  );
  try {
    const evidenceId = randomUUID();
    await executeCampaignCommand(
      db,
      {
        type: "record_permission",
        requestId: randomUUID(),
        membershipId: member.id,
        evidenceId,
        basis: "consent",
        provider: "gmail",
        jurisdiction: "GB",
        expiresAt: new Date(Date.now() + 3600000),
        observedAt: new Date(Date.now() - 1000),
        explicitOptIn: true,
        summary: "Recipient opted in.",
        reference: { kind: "private", value: "record" },
        expectedProspectVersion: 1,
        expectedContactVersion: 1,
        researchProofId: binding.id,
      },
      input.founder,
      randomUUID(),
    );
    const prepare = (runId: string) =>
      withGrowthTransaction(db, (tx) =>
        loadReviewMembershipPreparationAuthority(tx, {
          membershipId: member.id,
          connectionId: input.connectionId,
          source: { kind: "research_run", runId },
        }),
      );
    assert.equal((await prepare(ingested.runId))?.proof.origin, "research");
    assert.equal(await prepare(randomUUID()), null);
    await admin`update growth.prospects set version=version+1 where id=${prospectId}`;
    assert.equal(await prepare(ingested.runId), null);
  } finally {
    await admin`delete from growth.outreach_outbox where event_id in (select id from growth.outreach_events where membership_id=${member.id})`;
    await admin`delete from growth.outreach_events where membership_id=${member.id}`;
    await admin`update growth.campaign_memberships set current_permission_id=null where id=${member.id}`;
    await admin`delete from growth.outreach_permissions where membership_id=${member.id}`;
    await admin`delete from growth.campaign_memberships where id=${member.id}`;
  }
}
