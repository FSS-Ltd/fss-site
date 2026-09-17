import type { PortalInvitationClaim } from "@/lib/operations/auth/clerk-invitation";
import {
  claimClerkPortalInvitation,
  claimPortalInviteForVerifiedEmail,
  hasActivePortalMembership,
} from "@/lib/operations/auth/invites";
import { needsPortalOnboarding } from "@/lib/operations/auth/pending-invitations";
import type { VerifiedPortalIdentity } from "@/lib/operations/auth/types";
import type { OperationsDb } from "@/lib/operations/db/client";

type ClaimOutcome =
  | "active"
  | "onboarding_required"
  | "session_pending"
  | "access_denied"
  | "unavailable";

type ClaimFailureStage =
  | "identity"
  | "database"
  | "invitation_lookup"
  | "clerk_invitation_claim"
  | "staff_invitation_claim"
  | "staff_email_claim"
  | "verified_email_claim"
  | "membership"
  | "onboarding";

type ClaimErrorReport = {
  readonly correlationId: string;
  readonly errorName: string;
  readonly stage: ClaimFailureStage;
};

export type PortalAccessClaimDependencies = {
  configured: () => boolean;
  createCorrelationId: () => string;
  identity: () => Promise<VerifiedPortalIdentity | null>;
  invitationClaim: () => Promise<PortalInvitationClaim | null>;
  db: () => OperationsDb;
  claimClerkInvitation: typeof claimClerkPortalInvitation;
  claimStaffInvitation: typeof claimClerkPortalInvitation;
  claimStaffInvitationForVerifiedEmail: (
    db: OperationsDb,
    identity: VerifiedPortalIdentity,
    correlationId: string,
  ) => Promise<boolean>;
  claimVerifiedEmailInvite: typeof claimPortalInviteForVerifiedEmail;
  hasActiveMembership: typeof hasActivePortalMembership;
  needsOnboarding: typeof needsPortalOnboarding;
  reportUnexpectedError: (report: ClaimErrorReport) => void;
};

function response(
  outcome: ClaimOutcome,
  status: number,
  onboardingRequired = false,
): Response {
  return Response.json(
    onboardingRequired
      ? { active: false, onboardingRequired: true, outcome }
      : { active: outcome === "active", outcome },
    { status },
  );
}

function reportUnexpectedError(
  deps: PortalAccessClaimDependencies,
  correlationId: string,
  stage: ClaimFailureStage,
  error: unknown,
): Response {
  deps.reportUnexpectedError({
    correlationId,
    errorName: error instanceof Error ? error.name : "UnknownError",
    stage,
  });
  return response("unavailable", 503);
}

export function createPortalAccessClaimHandler(
  deps: PortalAccessClaimDependencies,
): () => Promise<Response> {
  return async function post(): Promise<Response> {
    const correlationId = deps.createCorrelationId();
    if (!deps.configured()) return response("unavailable", 503);

    let identity: VerifiedPortalIdentity | null;
    try {
      identity = await deps.identity();
    } catch (error) {
      return reportUnexpectedError(deps, correlationId, "identity", error);
    }
    if (!identity) return response("session_pending", 401);

    let stage: ClaimFailureStage = "database";
    try {
      const db = deps.db();
      stage = "invitation_lookup";
      const invitationClaim = await deps.invitationClaim();
      stage = "clerk_invitation_claim";
      if (
        await deps.claimClerkInvitation(
          db,
          invitationClaim,
          correlationId,
        )
      ) {
        return response("active", 200);
      }
      stage = "staff_invitation_claim";
      if (
        await deps.claimStaffInvitation(
          db,
          invitationClaim,
          correlationId,
        )
      ) {
        return response("active", 200);
      }
      stage = "staff_email_claim";
      if (
        await deps.claimStaffInvitationForVerifiedEmail(
          db,
          identity,
          correlationId,
        )
      ) {
        return response("active", 200);
      }
      stage = "verified_email_claim";
      if (
        await deps.claimVerifiedEmailInvite(db, identity, correlationId)
      ) {
        return response("active", 200);
      }
      stage = "membership";
      if (
        await deps.hasActiveMembership(db, identity, correlationId)
      ) {
        return response("active", 200);
      }
      stage = "onboarding";
      const onboardingRequired = await deps.needsOnboarding(
        db,
        identity,
        correlationId,
      );
      return onboardingRequired
        ? response("onboarding_required", 200, true)
        : response("access_denied", 403);
    } catch (error) {
      return reportUnexpectedError(deps, correlationId, stage, error);
    }
  };
}
