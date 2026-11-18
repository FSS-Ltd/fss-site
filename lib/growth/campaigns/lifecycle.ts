import type { GrowthTransaction } from "../db/types";
import type { CampaignPolicyDefinition } from "./schemas";
import { isSupportedPermission } from "./permission-evidence";

export function validateCampaignDefinition(
  policy: CampaignPolicyDefinition,
  expectedVersion: number,
  now: Date,
  forApproval: boolean,
): void {
  if (
    policy.version !== expectedVersion ||
    policy.status !== "paused" ||
    policy.approvedAt ||
    policy.approverId ||
    policy.providerReserve < 50
  )
    throw new Error("invalid_policy_definition");
  const capability = policy.capabilityAttestation;
  const provider = policy.providerAttestation;
  if (
    provider.provider !== policy.provider ||
    provider.jurisdiction !== policy.jurisdiction ||
    capability.reference.value !== policy.capabilityEvidence
  )
    throw new Error("policy_attestation_mismatch");
  for (const evidence of [capability, provider]) {
    if (
      evidence.observedAt > now ||
      evidence.expiresAt <= now ||
      evidence.observedAt >= evidence.expiresAt
    )
      throw new Error("policy_attestation_expired");
  }
  if (
    forApproval &&
    (!policy.effectiveAt ||
      policy.effectiveAt > now ||
      !policy.expiresAt ||
      policy.expiresAt <= now ||
      !policy.offer ||
      !policy.permissionRequirement ||
      !isSupportedPermission(
        policy.permissionRequirement,
        policy.provider,
        policy.jurisdiction,
      ) ||
      !policy.haltThresholds ||
      !policy.cadenceFamily ||
      policy.variants.length !== 2 ||
      policy.variants[0]!.id === policy.variants[1]!.id ||
      policy.variants[0]!.version !== policy.variants[1]!.version ||
      policy.variants[0]!.cta === policy.variants[1]!.cta)
  )
    throw new Error("policy_not_approvable");
}
export async function cancelCampaignJobs(
  tx: GrowthTransaction,
  campaignId: string,
  membershipId?: string,
): Promise<void> {
  await tx`update growth.outreach_jobs set status='cancelled',lease_owner=null,lease_until=null,lease_revision=lease_revision+1 where campaign_id=${campaignId} and membership_id is not null and (${membershipId ?? null}::uuid is null or membership_id=${membershipId ?? null}::uuid) and job_type='follow_up' and status in ('pending','leased','held')`;
}

export function serializeCampaignDefinition(policy: CampaignPolicyDefinition) {
  return {
    ...policy,
    approvedAt: policy.approvedAt?.toISOString() ?? null,
    effectiveAt: policy.effectiveAt?.toISOString() ?? null,
    expiresAt: policy.expiresAt?.toISOString() ?? null,
    capabilityAttestation: {
      ...policy.capabilityAttestation,
      observedAt: policy.capabilityAttestation.observedAt.toISOString(),
      expiresAt: policy.capabilityAttestation.expiresAt.toISOString(),
    },
    providerAttestation: {
      ...policy.providerAttestation,
      observedAt: policy.providerAttestation.observedAt.toISOString(),
      expiresAt: policy.providerAttestation.expiresAt.toISOString(),
    },
  };
}
