import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import type { AgreementDraft } from "../../../lib/operations/agreements/types";
import type { OperationsDb } from "../../../lib/operations/db/client";
import { executeAgreementCommand } from "../../../lib/operations/agreements/service";
import {
  agreementDraft,
  signatureEvidence,
} from "../../../lib/operations/agreements/fixtures";
import {
  createDeliveryFixture,
  removeDeliveryFixture,
  deliveryFounder,
  type DeliveryFixture,
} from "./project-document-fixtures";
export { deliveryFounder as billingFounder };
export async function createBillingFixture(
  admin: OperationsDb,
  runtime: OperationsDb,
  signedDraft?: AgreementDraft,
) {
  const fixture = await createDeliveryFixture(admin, runtime);
  const draft = signedDraft ?? agreementDraft();
  if (!signedDraft) {
    draft.lines[0].taxPence = "0";
    draft.lines[0].unitPence = "12000";
  }
  await executeAgreementCommand(
    runtime,
    deliveryFounder,
    fixture.organisationId,
    {
      action: "revise",
      agreementId: fixture.agreementId,
      expectedVersion: 1,
      draft,
    },
    fixture.correlationId,
  );
  await executeAgreementCommand(
    runtime,
    deliveryFounder,
    fixture.organisationId,
    {
      action: "sign",
      agreementId: fixture.agreementId,
      expectedVersion: 2,
      evidence: signatureEvidence(),
    },
    fixture.correlationId,
  );
  return {
    ...fixture,
    revision: 2,
    scope: {
      organisationId: fixture.organisationId,
      accountId: "acct_billingTest",
      mode: "test" as const,
    },
  };
}
export async function removeBillingFixture(
  admin: OperationsDb,
  fixture: DeliveryFixture,
): Promise<void> {
  for (const table of [
    "billing_amendment_previews",
    "invoices",
    "billing_commands",
    "billing_schedules",
    "billing_customers",
    "signature_evidence",
  ])
    await admin.unsafe(
      `delete from operations.${table} where organisation_id=$1`,
      [fixture.organisationId],
    );
  await removeDeliveryFixture(admin, fixture);
}

export async function createSignedBillingAmendment(
  runtime: OperationsDb,
  fixture: Awaited<ReturnType<typeof createBillingFixture>>,
  draft: AgreementDraft,
): Promise<{ agreementId: string; revision: number }> {
  const agreement = await executeAgreementCommand(
    runtime,
    deliveryFounder,
    fixture.organisationId,
    { action: "create", engagementId: fixture.engagementId, draft },
    fixture.correlationId,
  );
  await executeAgreementCommand(
    runtime,
    deliveryFounder,
    fixture.organisationId,
    {
      action: "sign",
      agreementId: agreement.id,
      expectedVersion: 1,
      evidence: signatureEvidence(),
    },
    fixture.correlationId,
  );
  return { agreementId: agreement.id, revision: 1 };
}

export function createBillingTestDatabases(): {
  admin: OperationsDb;
  db: OperationsDb;
} {
  const url = requireOperationsTestDatabaseUrl(
    process.env.OPERATIONS_TEST_DATABASE_URL,
  );
  return {
    admin: postgres(url, { max: 1 }),
    db: postgres(url, {
      max: 3,
      connection: { options: "-c role=operations_founder" },
    }),
  };
}
