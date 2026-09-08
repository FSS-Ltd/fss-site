import { z } from "zod";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import type { OperationsFounder } from "../organisations/types";
import { withAgreementTransaction } from "../agreements/repository";
import type { JourneyView, JourneyJob } from "./command-types";
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
