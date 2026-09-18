import { randomUUID } from "node:crypto";
import type { OperationsDb } from "../../../lib/operations/db/client";
import {
  createDeliveryFixture,
  deliveryFounder,
  projectMetadata,
  removeDeliveryFixture,
} from "./project-document-fixtures";
import { executeProjectCommand } from "../../../lib/operations/projects/service";
import { executeAgreementCommand } from "../../../lib/operations/agreements/service";
import {
  agreementDraft,
  signatureEvidence,
} from "../../../lib/operations/agreements/fixtures";
export async function requestFixture(
  admin: OperationsDb,
  founder: OperationsDb,
) {
  const fixture = await createDeliveryFixture(admin, founder);
  const project = await executeProjectCommand(
    founder,
    deliveryFounder,
    fixture.organisationId,
    {
      action: "create",
      metadata: projectMetadata(fixture),
      reviewReference: "synthetic",
    },
    fixture.correlationId,
  );
  return { ...fixture, projectId: project.id };
}
export function newRequest(projectId: string) {
  return {
    projectId,
    title: "Synthetic request",
    description: "Plain text <script> is rendered as text.",
    type: "work",
    desiredOutcome: "Agreed delivery",
    idempotencyKey: randomUUID(),
  };
}
export async function activateRequestAgreement(
  founder: OperationsDb,
  f: Awaited<ReturnType<typeof requestFixture>>,
) {
  const execute = (raw: unknown) =>
    executeAgreementCommand(
      founder,
      deliveryFounder,
      f.organisationId,
      raw,
      f.correlationId,
    );
  const draft = agreementDraft();
  draft.lines[0].startDate = "2026-09-06";
  const revised = await execute({
    action: "revise",
    agreementId: f.agreementId,
    expectedVersion: 1,
    draft,
  });
  const signed = await execute({
    action: "sign",
    agreementId: f.agreementId,
    expectedVersion: revised.version,
    evidence: signatureEvidence(),
  });
  await execute({
    action: "activate",
    agreementId: f.agreementId,
    expectedVersion: signed.version,
    lineNumber: 1,
    evidence: {
      effectiveDate: "2026-09-06",
      assetsReady: true,
      deposit: {
        amountPence: "6000",
        verifiedDate: "2026-09-06",
        reference: "synthetic",
      },
    },
  });
}
export async function removeRequestFixture(
  admin: OperationsDb,
  f: Awaited<ReturnType<typeof requestFixture>>,
) {
  await admin.begin(async (tx) => {
    await tx`select set_config('operations.actor_id',${deliveryFounder.actorId},true),set_config('operations.correlation_id',${f.correlationId},true)`;
    await tx`delete from operations.request_history where organisation_id=${f.organisationId}`;
    await tx`delete from operations.request_email_deliveries where organisation_id=${f.organisationId}`;
    await tx`delete from operations.request_notifications where organisation_id=${f.organisationId}`;
    await tx`delete from operations.request_notification_outbox where organisation_id=${f.organisationId}`;
    await tx`delete from operations.request_documents where organisation_id=${f.organisationId}`;
    await tx`delete from operations.request_reviews where organisation_id=${f.organisationId}`;
    await tx`delete from operations.request_reviewers where organisation_id=${f.organisationId}`;
    await tx`delete from operations.request_allowance_adjustments where organisation_id=${f.organisationId}`;
    await tx`delete from operations.request_comments where organisation_id=${f.organisationId}`;
    await tx`delete from operations.request_history where organisation_id=${f.organisationId}`;
    await tx`delete from operations.requests where organisation_id=${f.organisationId}`;
    await tx`delete from operations.service_instances where organisation_id=${f.organisationId}`;
    await tx`delete from operations.signature_evidence where organisation_id=${f.organisationId}`;
  });
  await removeDeliveryFixture(admin, f);
}
