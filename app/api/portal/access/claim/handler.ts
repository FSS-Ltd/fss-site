import { z } from "zod";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "@/lib/growth/http/founder-request";
import type { PortalInvitationClaim } from "@/lib/operations/auth/clerk-invitation";
import {
  claimClerkPortalInvitation,
  claimPortalInviteForVerifiedEmail,
  hasActivePortalMembership,
} from "@/lib/operations/auth/invites";
import { getActiveStaffMembership } from "@/lib/operations/auth/staff-invitations";
import { needsPortalOnboarding } from "@/lib/operations/auth/pending-invitations";
import type { VerifiedPortalIdentity } from "@/lib/operations/auth/types";
import type { OperationsDb } from "@/lib/operations/db/client";
import { userProfileNameSchema } from "@/lib/operations/auth/user-profile";

type ClaimOutcome =
  | "active"
  | "onboarding_required"
  | "session_pending"
  | "access_denied"
  | "unavailable";

type ClaimFailureStage =
  | "identity"
  | "profile"
  | "database"
  | "invitation_lookup"
  | "clerk_invitation_claim"
  | "staff_invitation_claim"
  | "staff_email_claim"
  | "staff_membership"
  | "clerk_staff_invitation_reconciliation"
  | "clerk_portal_invitation_reconciliation"
  | "pending_invitation_claim"
  | "verified_email_claim"
  | "membership"
  | "onboarding";

type ReconcileInvitations = (
  email: string,
  db: OperationsDb,
  identity: VerifiedPortalIdentity,
  correlationId: string,
) => Promise<void>;

type ClaimErrorReport = {
  readonly correlationId: string;
  readonly errorName: string;
  readonly stage: ClaimFailureStage;
};

export type PortalAccessClaimDependencies = {
  configured: () => boolean;
  origin: () => string;
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
  reconcilePendingClerkStaffInvitations: ReconcileInvitations;
  reconcilePendingClerkPortalInvitations: ReconcileInvitations;
  claimPendingInvitation: (
    db: OperationsDb,
    identity: VerifiedPortalIdentity,
    correlationId: string,
  ) => Promise<"portal" | "onboarding" | null>;
  hasActiveStaffMembership: typeof getActiveStaffMembership;
  claimVerifiedEmailInvite: typeof claimPortalInviteForVerifiedEmail;
  hasActiveMembership: typeof hasActivePortalMembership;
  needsOnboarding: typeof needsPortalOnboarding;
  studioEnabled: () => boolean;
  saveProfile?: (
    db: OperationsDb,
    identity: VerifiedPortalIdentity,
    displayName: string,
    correlationId: string,
  ) => Promise<unknown>;
  reportUnexpectedError: (report: ClaimErrorReport) => void;
};

function response(
  outcome: ClaimOutcome,
  status: number,
  onboardingRequired = false,
  destination?: "admin" | "portal" | "onboarding",
): Response {
  return Response.json(
    onboardingRequired
      ? {
          active: false,
          onboardingRequired: true,
          outcome,
          destination: "onboarding",
        }
      : {
          active: outcome === "active",
          outcome,
          ...(destination ? { destination } : {}),
        },
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
): (request: Request) => Promise<Response> {
  return async function post(request: Request): Promise<Response> {
    const correlationId = deps.createCorrelationId();
    if (!deps.configured()) return response("unavailable", 503);
    if (!requestHasRegisteredOrigin(request, new URL(deps.origin()).origin))
      return Response.json(
        { message: "Request origin is not allowed." },
        { status: 403 },
      );
    if (
      request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
    )
      return Response.json(
        { message: "Send a JSON request." },
        { status: 415 },
      );

    let identity: VerifiedPortalIdentity | null;
    try {
      identity = await deps.identity();
    } catch (error) {
      return reportUnexpectedError(deps, correlationId, "identity", error);
    }
    if (!identity) return response("session_pending", 401);

    {
      let displayName: string | undefined;
      try {
        const body = z
          .strictObject({ displayName: userProfileNameSchema.optional() })
          .parse(await readJsonRequestBody(request, 8 * 1024));
        displayName = body.displayName;
      } catch (error) {
        if (error instanceof PayloadTooLargeError)
          return Response.json(
            { message: "Request is too large." },
            { status: 413 },
          );
        return Response.json(
          { message: "A valid display name is required." },
          { status: 422 },
        );
      }

      if (displayName && deps.saveProfile) {
        try {
          await deps.saveProfile(
            deps.db(),
            identity,
            displayName,
            correlationId,
          );
        } catch (error) {
          return reportUnexpectedError(deps, correlationId, "profile", error);
        }
      }
    }

    const verifiedIdentity = identity;
    const staffDestination = (): "admin" | "portal" =>
      deps.studioEnabled() ? "admin" : "portal";
    async function reconcile(
      realm: "staff" | "portal",
      db: OperationsDb,
    ): Promise<void> {
      try {
        await (
          realm === "staff"
            ? deps.reconcilePendingClerkStaffInvitations
            : deps.reconcilePendingClerkPortalInvitations
        )(verifiedIdentity.email, db, verifiedIdentity, correlationId);
      } catch (error) {
        deps.reportUnexpectedError({
          correlationId,
          errorName: error instanceof Error ? error.name : "UnknownError",
          stage:
            realm === "staff"
              ? "clerk_staff_invitation_reconciliation"
              : "clerk_portal_invitation_reconciliation",
        });
      }
    }

    let stage: ClaimFailureStage = "database";
    try {
      const db = deps.db();
      stage = "invitation_lookup";
      const invitationClaim = await deps.invitationClaim();
      stage = "staff_invitation_claim";
      if (await deps.claimStaffInvitation(db, invitationClaim, correlationId)) {
        await reconcile("staff", db);
        return response("active", 200, false, staffDestination());
      }
      stage = "staff_email_claim";
      if (
        await deps.claimStaffInvitationForVerifiedEmail(
          db,
          identity,
          correlationId,
        )
      ) {
        await reconcile("staff", db);
        return response("active", 200, false, staffDestination());
      }
      stage = "staff_membership";
      if (await deps.hasActiveStaffMembership(db, identity, correlationId)) {
        await reconcile("staff", db);
        return response("active", 200, false, staffDestination());
      }
      stage = "pending_invitation_claim";
      const pendingDestination = await deps.claimPendingInvitation(
        db,
        identity,
        correlationId,
      );
      if (pendingDestination) {
        await reconcile("portal", db);
        return pendingDestination === "onboarding"
          ? response("onboarding_required", 200, true)
          : response("active", 200, false, "portal");
      }
      stage = "clerk_invitation_claim";
      if (await deps.claimClerkInvitation(db, invitationClaim, correlationId)) {
        await reconcile("portal", db);
        return response("active", 200, false, "portal");
      }
      stage = "verified_email_claim";
      if (await deps.claimVerifiedEmailInvite(db, identity, correlationId)) {
        await reconcile("portal", db);
        return response("active", 200, false, "portal");
      }
      stage = "membership";
      if (await deps.hasActiveMembership(db, identity, correlationId)) {
        await reconcile("portal", db);
        return response("active", 200, false, "portal");
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
