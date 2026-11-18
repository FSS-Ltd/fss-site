import {
  isSupportedPermission,
  validPermissionEvidence,
} from "./permission-evidence";
import type {
  CampaignPolicy,
  EligibilityDecision,
  EligibilitySnapshot,
} from "./schemas";

export function evaluateCampaignEligibility(
  policy: CampaignPolicy,
  snapshot: EligibilitySnapshot,
  now: Date,
): EligibilityDecision {
  const blocked = (reason: string): EligibilityDecision => ({
    status: "blocked",
    reason,
  });
  const review = (reason: string): EligibilityDecision => ({
    status: "review",
    reason,
  });
  if (policy.status === "revoked") return blocked("policy_revoked");
  if (
    snapshot.stopped ||
    snapshot.exclusion === "client" ||
    snapshot.exclusion === "suppressed"
  )
    return blocked("excluded_or_stopped");
  if (policy.status !== "approved") return review("policy_not_approved");
  if (snapshot.policyVersion !== policy.version)
    return review("policy_version_changed");
  if (
    !policy.approvedAt ||
    policy.approvedAt > now ||
    !policy.approverId ||
    !policy.effectiveAt ||
    !policy.expiresAt ||
    policy.effectiveAt > now ||
    policy.expiresAt <= now ||
    !policy.offer ||
    !policy.capabilityEvidence ||
    !policy.jurisdiction ||
    !policy.permissionRequirement ||
    !isSupportedPermission(
      policy.permissionRequirement,
      policy.provider,
      policy.jurisdiction,
    ) ||
    !policy.haltThresholds ||
    !policy.cadenceFamily ||
    policy.variants.length !== 2 ||
    policy.variants[0].id === policy.variants[1].id ||
    policy.variants[0].version !== policy.variants[1].version ||
    policy.variants[0].cta === policy.variants[1].cta
  )
    return review("policy_evidence_missing");
  if (snapshot.exclusion === "ambiguous") return review("identity_ambiguous");
  if (snapshot.providerHealth === "halted") return blocked("provider_halted");
  if (snapshot.providerHealth !== "healthy") return review("provider_unknown");
  const fresh = (d: Date | null) =>
    d !== null && d <= now && now.getTime() - d.getTime() <= 30 * 86400000;
  if (!fresh(snapshot.sourceVerifiedAt) || !fresh(snapshot.contactVerifiedAt))
    return review("verification_stale");
  if (
    !snapshot.permissionEvidence ||
    snapshot.permissionBasis !== policy.permissionRequirement ||
    !snapshot.permissionExpiresAt ||
    snapshot.permissionExpiresAt <= now ||
    snapshot.permissionProvider !== policy.provider ||
    snapshot.permissionJurisdiction !== policy.jurisdiction ||
    (policy.provider === "resend" && !snapshot.explicitOptIn) ||
    (policy.permissionRequirement === "requested_service" &&
      !validPermissionEvidence({
        basis: policy.permissionRequirement,
        provider: policy.provider,
        jurisdiction: policy.jurisdiction,
        offer: policy.offer,
        now,
        evidence: snapshot.permissionDetails,
      }))
  )
    return review("permission_missing");
  return { status: "eligible", reason: "eligible" };
}
