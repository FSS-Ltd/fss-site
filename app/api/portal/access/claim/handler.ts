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

type ClaimErrorReport = {
  readonly correlationId: string;
  readonly errorName: string;
};

export type PortalAccessClaimDependencies = {
  configured: () => boolean;
  createCorrelationId: () => string;
  identity: () => Promise<VerifiedPortalIdentity | null>;
  invitationClaim: () => Promise<PortalInvitationClaim | null>;
  db: () => OperationsDb;
  claimClerkInvitation: typeof claimClerkPortalInvitation;
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
  error: unknown,
): Response {
  deps.reportUnexpectedError({
    correlationId,
    errorName: error instanceof Error ? error.name : "UnknownError",
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
      return reportUnexpectedError(deps, correlationId, error);
    }
    if (!identity) return response("session_pending", 401);

    try {
      const db = deps.db();
      const activeFromClerkInvitation = await deps.claimClerkInvitation(
        db,
        await deps.invitationClaim(),
        correlationId,
      );
      const active =
        activeFromClerkInvitation ||
        (await deps.claimVerifiedEmailInvite(db, identity, correlationId)) ||
        (await deps.hasActiveMembership(db, identity, correlationId));
      if (active) return response("active", 200);
      const onboardingRequired = await deps.needsOnboarding(
        db,
        identity,
        correlationId,
      );
      return onboardingRequired
        ? response("onboarding_required", 200, true)
        : response("access_denied", 403);
    } catch (error) {
      return reportUnexpectedError(deps, correlationId, error);
    }
  };
}
