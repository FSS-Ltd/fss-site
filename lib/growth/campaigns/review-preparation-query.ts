import { createHash } from "node:crypto";
import type { GrowthTransaction } from "../db/types";

export type PreparationSource =
  | { kind: "research_run"; runId: string }
  | { kind: "permission_event"; eventId: string };

export type ReviewPreparationCandidate = {
  prospectId: string;
  contactId: string;
  prospectVersion: number;
  contactVersion: number;
  proofOrigin: "founder" | "research" | null;
  proofRequestId: string | null;
  researchProofId: string | null;
  policy: unknown;
  policyVersion: number;
  approvedBy: string;
  basis: string;
  provider: string;
  jurisdiction: string;
  country: string;
  evidence: unknown;
  permissionExpiresAt: Date;
};

// Returns candidate rows only; the caller independently validates policy, permission and proof.
export async function readReviewPreparationCandidate(
  db: GrowthTransaction,
  input: {
    membershipId: string;
    connectionId: string;
    source: PreparationSource;
  },
  now: Date,
): Promise<ReviewPreparationCandidate | null> {
  const runId =
    input.source.kind === "research_run" ? input.source.runId : null;
  const eventId =
    input.source.kind === "permission_event" ? input.source.eventId : null;
  const [row] = await db<ReviewPreparationCandidate[]>`
    select m.prospect_id as "prospectId",p.contact_id as "contactId",p.prospect_version as "prospectVersion",p.contact_version as "contactVersion",
      p.proof_origin as "proofOrigin",p.proof_request_id as "proofRequestId",p.research_proof_id as "researchProofId",
      c.policy,c.version as "policyVersion",c.approved_by as "approvedBy",p.basis,p.provider,p.jurisdiction,b.country_code as country,p.evidence,p.expires_at as "permissionExpiresAt"
    from growth.campaign_memberships m
    join growth.campaigns c on c.id=m.campaign_id and c.version=m.policy_version
    join growth.outreach_permissions p on p.id=m.current_permission_id and p.membership_id=m.id
    join growth.prospects prospect on prospect.id=m.prospect_id
    join growth.contacts contact on contact.id=prospect.primary_contact_id and contact.id=p.contact_id
    join growth.businesses b on b.id=prospect.business_id
    where m.id=${input.membershipId} and m.status='review' and m.sequence_id is null
      and c.status='approved' and c.approved_by is not null and c.approved_at is not null and c.approved_at <= ${now}
      and c.account_connection_id=${input.connectionId} and c.version=(select max(version) from growth.campaigns where id=c.id)
      and p.provider='gmail' and p.expires_at > ${now} and p.proof_origin in ('founder','research') and p.actor_id=${createHash("sha256").update("j.ntagengwa@faithfulsoftware.dev").digest("hex")}
      and b.corporate_status='active' and prospect.status in ('ready_for_email_review','contacted')
      and not growth.is_outreach_client(prospect.id)
      and not exists(select 1 from growth.suppressions s where s.business_id=prospect.business_id or s.normalised_email=contact.normalised_email)
      and ((p.proof_origin='research' and ${runId}::uuid is not null and exists(select 1 from growth.research_source_proof_bindings source where source.id=p.research_proof_id and source.research_run_id=${runId}::uuid))
        or (${eventId}::uuid is not null and exists(select 1 from growth.outreach_events e join growth.outreach_outbox o on o.event_id=e.id where e.id=${eventId}::uuid and e.event_type='record_permission' and e.membership_id=m.id and e.campaign_id=m.campaign_id and e.policy_version=m.policy_version and e.result_id=p.id and e.request_id=e.id and e.actor_id=p.actor_id and e.request_hash is not null)))
  `;
  return row ?? null;
}
