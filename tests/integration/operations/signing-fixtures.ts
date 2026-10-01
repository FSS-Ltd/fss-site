import { randomUUID } from "node:crypto";
import postgres from "postgres";
import type { TestContext } from "node:test";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import { createEngagement } from "./fixtures";
import { applyReviewedMapping } from "../../../lib/operations/organisations/repository";
import { executeAgreementCommand } from "../../../lib/operations/agreements/service";
import { agreementDraft } from "../../../lib/operations/agreements/fixtures";
import {
  prepareAgreementSigning,
  approveAgreementSigning,
  signPortalAgreement,
} from "../../../lib/operations/agreements/signing-service";
import type { SigningApproval } from "../../../lib/operations/agreements/signing-types";
import { registerFixtureCleanup } from "./fixture-cleanup";
export async function signingFixture(
  t: TestContext,
  signerCount = 2,
  options: { taxFree?: boolean } = {},
) {
  const url = requireOperationsTestDatabaseUrl(
    process.env.OPERATIONS_TEST_DATABASE_URL,
  );
  const admin = postgres(url, { max: 2 });
  const founderDb = postgres(url, {
    max: 3,
    connection: { options: "-c role=operations_founder" },
  });
  const portal = postgres(url, {
    max: 3,
    connection: { options: "-c role=operations_portal" },
  });
  const worker = postgres(url, {
    max: 3,
    connection: { options: "-c role=operations_signing_worker" },
  });
  const founder = { actorId: "c".repeat(64) };
  const organisationId = randomUUID();
  const correlationId = randomUUID();
  const engagement = await createEngagement(admin);
  const identities = Array.from({ length: signerCount }, (_, i) => ({
    userId: randomUUID(),
    email: `signer${i}@example.test`,
    emailVerified: true as const,
  }));
  const clean = registerFixtureCleanup(async () => {
    await Promise.all([founderDb.end(), portal.end(), worker.end()]);
    try {
      await admin.begin(async (tx) => {
        await tx`set constraints all deferred`;
        const studioEngagements = await tx<{ id: string }[]>`
          select id from growth.delivery_engagements
          where studio_organisation_id=${organisationId}
        `;
        const studioEngagementIds = studioEngagements.map((row) => row.id);
        await tx`delete from operations.staff_engagement_commands where organisation_id=${organisationId}`;
        await tx`delete from operations.studio_engagement_reviews where organisation_id=${organisationId}`;
        await tx`delete from operations.agreement_builder_drafts where organisation_id=${organisationId}`;
        if (studioEngagementIds.length) {
          await tx`delete from operations.engagement_links where engagement_id=any(${studioEngagementIds}::uuid[])`;
          await tx`delete from growth.commercial_stage_events where engagement_id=any(${studioEngagementIds}::uuid[])`;
          await tx`delete from growth.delivery_engagements where id=any(${studioEngagementIds}::uuid[])`;
        }
        for (const table of [
          "signing_completion_outbox",
          "signing_audit_events",
          "signing_artifacts",
          "signing_signatures",
          "signing_approvals",
          "signature_evidence",
          "agreement_lines",
          "agreement_revisions",
          "agreements",
          "memberships",
          "contacts",
          "audit_events",
          "engagement_links",
          "organisations",
        ]) {
          await tx.unsafe(
            `delete from operations.${table} where ${table === "organisations" ? "id" : "organisation_id"}=$1`,
            [organisationId],
          );
        }
      });
      await admin`delete from growth.commercial_stage_events where engagement_id=${engagement.engagementId}`;
      await admin`delete from growth.audit_log where entity_id=${engagement.engagementId}`;
      await admin`delete from growth.sequence_enrollments where prospect_id=${engagement.prospectId}`;
      await admin`delete from growth.delivery_engagements where id=${engagement.engagementId}`;
      await admin`delete from growth.prospects where id=${engagement.prospectId}`;
      await admin`delete from growth.contacts where id=${engagement.contactId}`;
      await admin`delete from growth.businesses where id=${engagement.businessId}`;
    } finally {
      await admin.end();
    }
  });
  t.after(clean);
  await applyReviewedMapping(founderDb, founder, {
    reviewReference: "signing-test",
    organisations: [
      {
        id: organisationId,
        legalName: "Signing Test Limited",
        displayName: "Signing Test",
        tradingStatus: "active",
        timezone: "Europe/London",
        engagementIds: [engagement.engagementId],
      },
    ],
  });
  for (const identity of identities) {
    const [contact] = await admin<
      { id: string }[]
    >`insert into operations.contacts(organisation_id,name,email,created_by,review_reference) values(${organisationId},'Test Signer',${identity.email},${founder.actorId},'signing-test') returning id`;
    await admin`insert into operations.memberships(organisation_id,contact_id,user_id,role) values(${organisationId},${contact.id},${identity.userId},'owner')`;
  }
  const draft = {
    ...agreementDraft(),
    signatories: identities.map((i) => i.email),
  };
  if (options.taxFree)
    draft.lines = draft.lines.map((line) => ({
      ...line,
      unitPence: "12000",
      taxPence: "0",
    }));
  const record = await executeAgreementCommand(
    founderDb,
    founder,
    organisationId,
    { action: "create", engagementId: engagement.engagementId, draft },
    correlationId,
  );
  const prepare = () =>
    prepareAgreementSigning(
      founderDb,
      founder,
      organisationId,
      { agreementId: record.id, expectedVersion: record.version },
      correlationId,
    );
  const approve = (p: SigningApproval) =>
    approveAgreementSigning(
      founderDb,
      founder,
      organisationId,
      {
        approvalId: p.id,
        approvalHash: p.approvalHash,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
      correlationId,
    );
  const sign = (p: SigningApproval, index = 0) =>
    signPortalAgreement(
      portal,
      identities[index],
      organisationId,
      {
        approvalId: p.id,
        approvalHash: p.approvalHash,
        typedName: `Signer ${index}`,
        authority: true,
        consent: true,
      },
      correlationId,
    );
  return {
    admin,
    founderDb,
    portal,
    worker,
    founder,
    organisationId,
    correlationId,
    identities,
    record,
    draft,
    engagement,
    prepare,
    approve,
    sign,
  };
}
