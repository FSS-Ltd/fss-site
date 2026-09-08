import { z } from "zod";
import type { OperationsDb } from "../db/client";
import type { EffectReceipt, OnboardingLease, OnboardingStore } from "./types";
export function onboardingStore(db: OperationsDb): OnboardingStore {
  return {
    async claim(limit, now) {
      z.number().int().min(1).max(100).parse(limit);
      const [role] = await db<{ name: string }[]>`select current_user as name`;
      if (role.name !== "operations_onboarding_worker")
        throw new Error("Onboarding worker authorization required.");
      return db.begin(async (tx) => {
        const claimed = await tx<
          { id: string }[]
        >`select id from operations.claim_onboarding(${limit},${now.toISOString()})`;
        if (!claimed.length) return [];
        const leases = await tx<OnboardingLease[]>`
          select b.id as "jobId",b.recipient,b.journey_id as "journeyId",b.organisation_id as "organisationId",j.agreement_id as "agreementId",j.approval_id as "approvalId",p.signing_approval_id as "signingApprovalId",b.step,b.generation,b.lease_token as "leaseToken",b.idempotency_key as "idempotencyKey",b.attempts,
          b.first_attempt_at::text as "firstAttemptAt",b.due_at::text as "dueAt",a.snapshot,p.snapshot as proposal,a.pdf,
          coalesce(e.status='unknown_outcome',false) as uncertain,
          (select f.receipt from operations.onboarding_effects f join operations.onboarding_jobs q on q.id=f.job_id where q.journey_id=j.id and q.step='invoice' and f.status='succeeded') as invoice,
          (select f.receipt from operations.onboarding_effects f join operations.onboarding_jobs q on q.id=f.job_id where q.journey_id=j.id and q.step='invitation' and q.recipient=b.recipient and f.status='succeeded') as invitation
          from operations.onboarding_jobs b join operations.onboarding_journeys j on j.id=b.journey_id join operations.onboarding_approvals a on a.id=j.approval_id left join operations.onboarding_proposal_approvals p on p.id=j.proposal_approval_id left join operations.onboarding_effects e on e.job_id=b.id where b.id in ${tx(claimed.map((r) => r.id))}`;
        return [...leases];
      });
    },
    async beginEffect(lease) {
      const [row] = await db<
        { allowed: boolean }[]
      >`select operations.begin_onboarding_effect(${lease.jobId},${lease.leaseToken},${lease.generation}) as allowed`;
      return row.allowed;
    },
    async succeed(lease, receipt: EffectReceipt) {
      await db`select operations.finish_onboarding_effect(${lease.jobId},${lease.leaseToken},${JSON.stringify(receipt)}::text::jsonb)`;
    },
    async fail(lease, code, nextAttempt, uncertain) {
      await db`select operations.fail_onboarding_effect(${lease.jobId},${lease.leaseToken},${code},${nextAttempt?.toISOString() ?? null},${uncertain})`;
    },
  };
}
