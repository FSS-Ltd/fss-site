import postgres from "postgres";
import type { TestContext } from "node:test";
import { randomUUID } from "node:crypto";
import { signingFixture } from "./signing-fixtures";
import { preparedWelcomeFixture } from "../../../lib/operations/onboarding/fixtures";
import {
  startApprovedJourney,
  approveJourneyProposal,
} from "../../../lib/operations/onboarding/repository";
import type { ProposalApprovalSnapshot } from "../../../lib/operations/onboarding/types";
import { prepareProposal } from "../../../lib/operations/onboarding/approval";
import { onboardingStore } from "../../../lib/operations/onboarding/outbox";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import { registerFixtureCleanup } from "./fixture-cleanup";

export async function onboardingFixture(
  t: TestContext,
  signers = 2,
  options: {
    taxFree?: boolean;
    futureBillingDates?: boolean;
    welcomeRecipient?: string;
    accessContacts?: ProposalApprovalSnapshot["access"];
  } = {},
) {
  const cleanup: {
    signing?: Awaited<ReturnType<typeof signingFixture>>;
    worker?: ReturnType<typeof postgres>;
  } = {};
  const signing = await signingFixture(t, signers, options);
  cleanup.signing = signing;
  const clean = registerFixtureCleanup(async () => {
    await cleanup.worker?.end();
    if (cleanup.signing) {
      await cleanup.signing
        .admin`delete from operations.onboarding_access_bindings where job_id in (select id from operations.onboarding_jobs where organisation_id=${cleanup.signing.organisationId})`;
      await cleanup.signing
        .admin`update operations.onboarding_journeys set onboarding_template_version_id = null, onboarding_workspace_draft_id = null where organisation_id = ${cleanup.signing.organisationId}`;
      for (const table of [
        "onboarding_journey_task_attachments",
        "onboarding_journey_tasks",
        "onboarding_journey_drafts",
        "onboarding_client_profiles",
        "onboarding_template_versions",
        "onboarding_templates",
        "onboarding_reconciliations",
        "onboarding_delivery_events",
        "onboarding_attempts",
        "onboarding_effects",
        "onboarding_jobs",
        "onboarding_journeys",
        "documents",
        "milestones",
        "projects",
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
  t.after(clean);
  const worker = postgres(
    requireOperationsTestDatabaseUrl(process.env.OPERATIONS_TEST_DATABASE_URL),
    { max: 4, connection: { options: "-c role=operations_onboarding_worker" } },
  );
  cleanup.worker = worker;
  for (const contact of options.accessContacts ?? []) {
    await signing.admin`insert into operations.contacts(organisation_id,name,email,created_by,review_reference) values(${signing.organisationId},'Approved access contact',${contact.email},${signing.founder.actorId},'onboarding-test')`;
  }
  const prepared = await preparedWelcomeFixture(
    options.welcomeRecipient ?? signing.identities[0].email,
  );
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
  // Represent a journey approved before the post-signature migration. New
  // starts use the signed-only command; this fixture protects historical flow.
  const snapshot = JSON.stringify(prepared.snapshot);
  await signing.admin.begin(async (tx) => {
    await tx`
      insert into operations.onboarding_approvals
        (id,organisation_id,agreement_id,approved_by,snapshot,pdf,pdf_hash,approval_hash)
      values
        (${approvalId},${signing.organisationId},${signing.record.id},${signing.founder.actorId},
         ${snapshot}::text::jsonb,${prepared.pdf},encode(sha256(${prepared.pdf}),'hex'),
         encode(sha256(convert_to(${snapshot}::text::jsonb::text,'UTF8')||${prepared.pdf}),'hex'))
    `;
    await tx`
      insert into operations.onboarding_journeys
        (id,organisation_id,agreement_id,approval_id)
      values (${journeyId},${signing.organisationId},${signing.record.id},${approvalId})
    `;
    await tx`
      select operations.onboarding_enqueue(j,'welcome',${prepared.snapshot.recipient},clock_timestamp())
      from operations.onboarding_journeys j where j.id=${journeyId}
    `;
  });
  const [seed] = await signing.admin<
    { sameSnapshot: boolean; samePdf: boolean; sameApproval: boolean }[]
  >`
    select a.snapshot=${snapshot}::text::jsonb as "sameSnapshot",
      a.pdf=${prepared.pdf} as "samePdf",
      j.approval_id=${approvalId} as "sameApproval"
    from operations.onboarding_approvals a
    join operations.onboarding_journeys j on j.approval_id=a.id
    where j.id=${journeyId}
  `;
  if (!seed?.sameSnapshot || !seed.samePdf || !seed.sameApproval)
    throw new Error(
      `Legacy journey fixture did not retain its approval: ${JSON.stringify(seed)}`,
    );
  const signingApproval = await signing.approve(await signing.prepare());
  const proposal = prepareProposal(
    {
      signingApprovalId: signingApproval.id,
      approvalHash: signingApproval.approvalHash,
      revision: signingApproval.revision,
      signers: signingApproval.requiredSigners,
      access: [
        ...signingApproval.requiredSigners.map((email) => ({
          email,
          role: "owner" as const,
        })),
        ...(options.accessContacts ?? []),
      ],
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
