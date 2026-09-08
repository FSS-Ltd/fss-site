import postgres from "postgres";
import type { TestContext } from "node:test";
import { randomUUID } from "node:crypto";
import { signingFixture } from "./signing-fixtures";
import { preparedWelcomeFixture } from "../../../lib/operations/onboarding/fixtures";
import {
  startApprovedJourney,
  approveJourneyProposal,
} from "../../../lib/operations/onboarding/repository";
import { prepareProposal } from "../../../lib/operations/onboarding/approval";
import { onboardingStore } from "../../../lib/operations/onboarding/outbox";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
export async function onboardingFixture(
  t: TestContext,
  signers = 2,
  options: { taxFree?: boolean } = {},
) {
  const cleanup: {
    signing?: Awaited<ReturnType<typeof signingFixture>>;
    worker?: ReturnType<typeof postgres>;
  } = {};
  t.after(async () => {
    await cleanup.worker?.end();
    if (cleanup.signing) {
      await cleanup.signing
        .admin`delete from operations.onboarding_access_bindings where job_id in (select id from operations.onboarding_jobs where organisation_id=${cleanup.signing.organisationId})`;
      for (const table of [
        "onboarding_reconciliations",
        "onboarding_delivery_events",
        "onboarding_attempts",
        "onboarding_effects",
        "onboarding_jobs",
        "onboarding_journeys",
        "onboarding_proposal_approvals",
        "onboarding_approvals",
        "invoices",
        "billing_commands",
        "billing_customers",
        "billing_schedules",
        "portal_invites",
      ])
        await cleanup.signing.admin.unsafe(
          `delete from operations.${table} where organisation_id=$1`,
          [cleanup.signing.organisationId],
        );
    }
  });
  const signing = await signingFixture(t, signers, options);
  cleanup.signing = signing;
  const worker = postgres(
    requireOperationsTestDatabaseUrl(process.env.OPERATIONS_TEST_DATABASE_URL),
    { max: 4, connection: { options: "-c role=operations_onboarding_worker" } },
  );
  cleanup.worker = worker;
  const prepared = await preparedWelcomeFixture(signing.identities[0].email);
  const approvalId = randomUUID(),
    journeyId = randomUUID();
  const input = {
    organisationId: signing.organisationId,
    agreementId: signing.record.id,
    approvalId,
    journeyId,
    prepared,
  };
  const start = () =>
    startApprovedJourney(signing.founderDb, signing.founder, input);
  await start();
  const signingApproval = await signing.approve(await signing.prepare());
  const proposal = prepareProposal(
    {
      signingApprovalId: signingApproval.id,
      approvalHash: signingApproval.approvalHash,
      revision: signingApproval.revision,
      signers: signingApproval.requiredSigners,
      access: signingApproval.requiredSigners.map((email) => ({
        email,
        role: "owner" as const,
      })),
      portalUrl: "https://example.test/portal/agreements",
      scopeSummary: "the approved request board",
    },
    prepared.snapshot,
  );
  const approve = () =>
    approveJourneyProposal(
      signing.founderDb,
      signing.founder,
      journeyId,
      proposal,
    );
  return {
    ...signing,
    signingWorker: signing.worker,
    worker,
    store: onboardingStore(worker),
    prepared,
    journeyId,
    approvalId,
    input,
    start,
    proposal,
    signingApproval,
    approve,
  };
}
