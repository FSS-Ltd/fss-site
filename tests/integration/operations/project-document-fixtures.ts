import { randomUUID } from "node:crypto";
import type { OperationsDb } from "../../../lib/operations/db/client";
import { applyReviewedMapping } from "../../../lib/operations/organisations/repository";
import { executeAgreementCommand } from "../../../lib/operations/agreements/service";
import { agreementDraft } from "../../../lib/operations/agreements/fixtures";
import { createEngagement } from "./fixtures";
export const deliveryFounder = { actorId: "d".repeat(64) };
export async function createDeliveryFixture(
  admin: OperationsDb,
  founder: OperationsDb,
) {
  const engagement = await createEngagement(admin);
  const organisationId = randomUUID();
  const correlationId = randomUUID();
  const identity = {
    userId: randomUUID(),
    email: `${randomUUID()}@example.test`,
    emailVerified: true as const,
  };
  await applyReviewedMapping(founder, deliveryFounder, {
    reviewReference: "synthetic-delivery",
    organisations: [
      {
        id: organisationId,
        legalName: "Delivery Test",
        displayName: "Delivery Test",
        tradingStatus: "active",
        timezone: "Europe/London",
        engagementIds: [engagement.engagementId],
      },
    ],
  });
  const agreement = await executeAgreementCommand(
    founder,
    deliveryFounder,
    organisationId,
    {
      action: "create",
      engagementId: engagement.engagementId,
      draft: agreementDraft(),
    },
    correlationId,
  );
  const [contact] = await admin<
    { id: string }[]
  >`insert into operations.contacts(organisation_id,name,email,created_by,review_reference) values (${organisationId},'Synthetic Contact',${identity.email},${deliveryFounder.actorId},'test') returning id`;
  await admin`insert into operations.memberships(organisation_id,contact_id,user_id,role) values (${organisationId},${contact.id},${identity.userId},'owner')`;
  return {
    ...engagement,
    organisationId,
    correlationId,
    identity,
    agreementId: agreement.id,
  };
}
export type DeliveryFixture = Awaited<ReturnType<typeof createDeliveryFixture>>;
export function projectMetadata(fixture: DeliveryFixture) {
  return {
    agreementId: fixture.agreementId,
    title: "Website delivery",
    summary: "Public summary",
    outcome: "Agreed outcome",
    deliverables: ["Accessible website"],
    status: "planned",
    ownerDisplay: "FSS",
    targetDate: null,
    scheduleDependencies: ["Client assets"],
    scheduleEvidence: null,
    internalNotes: "Never disclose margin discussions",
    internalEstimateMinutes: 120,
    visibility: "client",
  };
}
export async function removeDeliveryFixture(
  admin: OperationsDb,
  f: DeliveryFixture,
): Promise<void> {
  await admin.begin(async (tx) => {
    await tx`set constraints all deferred`;
    await tx`delete from operations.documents where organisation_id=${f.organisationId}`;
    await tx`delete from operations.milestones where organisation_id=${f.organisationId}`;
    await tx`delete from operations.projects where organisation_id=${f.organisationId}`;
    await tx`delete from operations.memberships where organisation_id=${f.organisationId}`;
    await tx`delete from operations.contacts where organisation_id=${f.organisationId}`;
    await tx`delete from operations.agreement_lines where organisation_id=${f.organisationId}`;
    await tx`delete from operations.agreement_revisions where organisation_id=${f.organisationId}`;
    await tx`delete from operations.agreements where organisation_id=${f.organisationId}`;
    await tx`delete from operations.engagement_links where organisation_id=${f.organisationId}`;
    await tx`delete from operations.audit_events where organisation_id=${f.organisationId}`;
    await tx`delete from operations.organisations where id=${f.organisationId}`;
  });
  await admin`delete from growth.delivery_engagements where id=${f.engagementId}`;
  await admin`delete from growth.prospects where id=${f.prospectId}`;
  await admin`delete from growth.contacts where id=${f.contactId}`;
  await admin`delete from growth.businesses where id=${f.businessId}`;
}
