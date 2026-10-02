import { z } from "zod";
import { welcomeInputSchema } from "./approval-schema";
import { journeyComposerSchema } from "./journey-composer-contract";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import type { OperationsFounder } from "../organisations/types";
import { portalRoles } from "../auth/types";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";
import { withAgreementTransaction } from "../agreements/repository";
import type { JourneyView, JourneyJob } from "./command-types";
import { onboardingTaskDefinitionSchema } from "./workspace-schema";
import {
  onboardingDueRules,
  onboardingTaskKinds,
  type OnboardingReadinessCheck,
  type OnboardingWorkspace,
} from "./workspace-types";
import {
  buildOnboardingReadiness,
  canStartOnboardingJourney,
} from "./readiness";

const onboardingWorkspaceSchema = z.strictObject({
  templates: z.array(
    z.strictObject({
      id: z.uuid(),
      templateId: z.uuid(),
      version: z.number().int().positive(),
      name: z.string().min(1).max(160),
      tasks: z.array(onboardingTaskDefinitionSchema),
      publishedAt: z.string().min(1),
    }),
  ),
  templateDrafts: z.array(
    z.strictObject({
      id: z.uuid(),
      name: z.string().min(1).max(160),
      draftVersion: z.number().int().positive(),
      publishedVersion: z.number().int().nonnegative(),
      tasks: z.array(onboardingTaskDefinitionSchema),
    }),
  ),
  journeyDrafts: z.array(
    z.strictObject({
      id: z.uuid(),
      agreementId: z.uuid(),
      contactId: z.uuid(),
      templateVersionId: z.uuid(),
      stage: z.enum(["setup", "content", "access", "schedule", "activate"]),
      expectedAgreementVersion: z.number().int().positive().nullable(),
      recipientRole: z.enum(portalRoles).nullable(),
      version: z.number().int().positive(),
      updatedAt: z.string().min(1),
      content: z
        .object({
          reviewedWelcome: welcomeInputSchema.optional(),
          composer: journeyComposerSchema.optional(),
          welcomeSubject: z.string().max(160).optional(),
          welcomeBody: z.string().max(10000).optional(),
        })
        .passthrough()
        .optional(),
    }),
  ),
  tasks: z.array(
    z.strictObject({
      id: z.uuid(),
      journeyId: z.uuid(),
      templateVersionId: z.uuid(),
      title: z.string().min(1).max(160),
      instructions: z.string().min(1).max(4_000),
      kind: z.enum(onboardingTaskKinds),
      required: z.boolean(),
      ownerRole: z.enum(portalRoles),
      dueRule: z.enum(onboardingDueRules),
      bookingUrl: z.string().url().nullable(),
      state: z.enum(["blocked", "available", "complete"]),
      completionDetail: z.string().min(1).nullable(),
    }),
  ),
});

export function parseOnboardingWorkspace(input: unknown): OnboardingWorkspace {
  return onboardingWorkspaceSchema.parse(input);
}

async function loadOnboardingWorkspace(
  tx: OperationsTransaction,
  organisationId: string,
): Promise<OnboardingWorkspace> {
  const [row] = await tx<Array<{ workspace: unknown }>>`
    select operations.read_onboarding_workspace(${organisationId}) as workspace
  `;
  if (!row) throw new Error("Onboarding workspace is unavailable.");
  return parseOnboardingWorkspace(row.workspace);
}

export async function loadFounderOnboardingWorkspace(
  db: OperationsDb,
  founder: OperationsFounder,
  organisationId: string,
): Promise<OnboardingWorkspace> {
  z.uuid().parse(organisationId);
  return withAgreementTransaction(db, founder, (tx) =>
    loadOnboardingWorkspace(tx, organisationId),
  );
}

export async function loadStaffOnboardingWorkspace(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
): Promise<OnboardingWorkspace> {
  z.uuid().parse(organisationId);
  return withFssAdminTransaction(db, admin, (tx) =>
    loadOnboardingWorkspace(tx, organisationId),
  );
}
export async function loadJourneys(
  tx: OperationsTransaction,
  organisationId: string,
): Promise<JourneyView[]> {
  const journeys = await tx<
    JourneyView[]
  >`select j.id,j.agreement_id as "agreementId",r.snapshot->>'title' as "agreementTitle",j.state,j.generation,j.proposal_approval_id as "proposalApprovalId",a.snapshot as welcome,p.snapshot as proposal,exists(select 1 from operations.signing_approvals s where s.id=p.signing_approval_id and s.status='approved' and s.expires_at>clock_timestamp() and s.approval_hash=p.snapshot->>'approvalHash' and g.current_revision=s.revision) as "currentProposal",j.proposal_due_at::text as "proposalDueAt",j.post_signature_due_at::text as "postSignatureDueAt",j.signature_at::text as "signatureAt",j.failure_code as "failureCode",'[]'::jsonb as jobs from operations.onboarding_journeys j join operations.onboarding_approvals a on a.id=j.approval_id join operations.agreements g on g.id=j.agreement_id join operations.agreement_revisions r on r.agreement_id=g.id and r.revision=g.current_revision left join operations.onboarding_proposal_approvals p on p.id=j.proposal_approval_id where j.organisation_id=${organisationId} order by j.created_at desc limit 50`;
  if (!journeys.length) return [];
  const jobs = await tx<
    (JourneyJob & { journeyId: string })[]
  >`select b.id,b.journey_id as "journeyId",b.step,b.recipient,b.state,b.due_at::text as "dueAt",b.attempts,b.failure_code as "failureCode",coalesce(e.unresolved_acceptance or e.status='unknown_outcome',false) as uncertain,e.receipt->>'providerId' as "providerId",e.receipt->>'acceptedAt' as "acceptedAt" from operations.onboarding_jobs b left join operations.onboarding_effects e on e.job_id=b.id where b.organisation_id=${organisationId} and b.journey_id in ${tx(journeys.map((j) => j.id))} order by b.due_at,b.step,b.recipient`;
  return journeys.map((j) => ({
    ...j,
    jobs: jobs.filter((b) => b.journeyId === j.id),
  }));
}
export async function listFounderJourneys(
  db: OperationsDb,
  founder: OperationsFounder,
  organisationId: string,
): Promise<JourneyView[]> {
  z.uuid().parse(organisationId);
  return withAgreementTransaction(db, founder, (tx) =>
    loadJourneys(tx, organisationId),
  );
}

export type StaffJourneyOverviewRow = {
  organisationId: string;
  organisationName: string;
  journeyCount: number;
  activeCount: number;
  recoveryCount: number;
};

export async function listStaffJourneys(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
): Promise<JourneyView[]> {
  z.uuid().parse(organisationId);
  return withFssAdminTransaction(db, admin, (tx) =>
    loadJourneys(tx, organisationId),
  );
}

export async function listStaffJourneyContacts(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
): Promise<Array<{ id: string; name: string; email: string }>> {
  z.uuid().parse(organisationId);
  return withFssAdminTransaction(
    db,
    admin,
    (tx) =>
      tx<Array<{ id: string; name: string; email: string }>>`
      select id, name, email
      from operations.contacts
      where organisation_id = ${organisationId}
      order by name, email
      limit 100
    `,
  );
}

export async function listStaffJourneyOverview(
  db: OperationsDb,
  admin: FssAdminContext,
): Promise<StaffJourneyOverviewRow[]> {
  return withFssAdminTransaction(
    db,
    admin,
    (tx) =>
      tx<StaffJourneyOverviewRow[]>`
        select
          o.id as "organisationId",
          o.display_name as "organisationName",
          count(j.id)::integer as "journeyCount",
          count(j.id) filter (where j.state in ('active', 'paused'))::integer as "activeCount",
          count(j.id) filter (where j.state = 'blocked' or j.failure_code is not null)::integer as "recoveryCount"
        from operations.organisations o
        left join operations.onboarding_journeys j on j.organisation_id = o.id
        where o.lifecycle = 'active'
        group by o.id, o.display_name
        order by o.display_name, o.id
        limit 200
      `,
  );
}

export type StaffJourneyRecovery = Readonly<{
  organisationId: string;
  organisationName: string;
  draftId: string;
  updatedAt: string;
  checks: readonly OnboardingReadinessCheck[];
  canStart: boolean;
}>;

export type StaffJourneyRecoveryAvailability = Readonly<{
  senderConfigured: boolean;
  billingConfigured: boolean;
  signingConfigured: boolean;
}>;

type StaffJourneyRecoveryRow = Readonly<{
  organisationId: string;
  organisationName: string;
  draftId: string;
  updatedAt: string;
  expectedAgreementVersion: number | null;
  recipientRole: string | null;
  agreementVersion: number | null;
  agreementStatus: string | null;
  contactAvailable: boolean;
  templateVersionAvailable: boolean;
  existingJourney: boolean;
}>;

/**
 * Loads the most recently saved welcome draft and derives its preflight from
 * retained Operations records. The result is informational only: the command
 * boundary repeats the same checks immediately before activation.
 */
export async function loadStaffJourneyRecovery(
  db: OperationsDb,
  admin: FssAdminContext,
  availability: StaffJourneyRecoveryAvailability,
): Promise<StaffJourneyRecovery | null> {
  return withFssAdminTransaction(db, admin, async (tx) => {
    const [row] = await tx<StaffJourneyRecoveryRow[]>`
      select
        d.organisation_id as "organisationId",
        o.display_name as "organisationName",
        d.id as "draftId",
        d.updated_at::text as "updatedAt",
        (d.content ->> 'expectedAgreementVersion')::integer as "expectedAgreementVersion",
        d.content ->> 'recipientRole' as "recipientRole",
        a.current_revision as "agreementVersion",
        a.status as "agreementStatus",
        exists(
          select 1 from operations.contacts c
          where c.organisation_id = d.organisation_id and c.id = d.contact_id
        ) as "contactAvailable",
        exists(
          select 1 from operations.onboarding_template_versions v
          where v.organisation_id = d.organisation_id and v.id = d.template_version_id
        ) as "templateVersionAvailable",
        exists(
          select 1 from operations.onboarding_journeys j
          where j.organisation_id = d.organisation_id and j.agreement_id = d.agreement_id
        ) as "existingJourney"
      from operations.onboarding_journey_drafts d
      join operations.organisations o on o.id = d.organisation_id
      left join operations.agreements a
        on a.organisation_id = d.organisation_id and a.id = d.agreement_id
      order by d.updated_at desc, d.id desc
      limit 1
    `;
    if (!row) return null;
    const checks = buildOnboardingReadiness({
      billingConfigured: availability.billingConfigured,
      contactAvailable: row.contactAvailable,
      currentAgreement:
        row.agreementVersion !== null &&
        row.expectedAgreementVersion === row.agreementVersion,
      noActiveJourney: !row.existingJourney,
      recipientRoleAllowed:
        row.recipientRole !== null &&
        portalRoles.includes(row.recipientRole as (typeof portalRoles)[number]),
      senderConfigured: availability.senderConfigured,
      signingReady:
        availability.signingConfigured && row.agreementStatus === "draft",
      templateVersionAvailable: row.templateVersionAvailable,
    });
    return {
      organisationId: row.organisationId,
      organisationName: row.organisationName,
      draftId: row.draftId,
      updatedAt: row.updatedAt,
      checks,
      canStart: canStartOnboardingJourney(checks),
    };
  });
}
