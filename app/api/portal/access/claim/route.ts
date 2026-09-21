import { randomUUID } from "node:crypto";
import { createPortalAccessClaimHandler } from "./handler";
import {
  portalAuthConfigured,
  resolvePortalOrigin,
} from "@/lib/operations/auth/configuration";
import {
  claimClerkPortalInvitation,
  claimPortalInviteForVerifiedEmail,
  hasActivePortalMembership,
} from "@/lib/operations/auth/invites";
import {
  claimClerkStaffInvitation,
  claimStaffInvitationForVerifiedEmail,
  getActiveStaffMembership,
} from "@/lib/operations/auth/staff-invitations";
import {
  claimPendingPortalInvitationForVerifiedEmail,
  needsPortalOnboarding,
  getClaimedInvitationIds,
} from "@/lib/operations/auth/pending-invitations";
import {
  getPortalIdentity,
  getPortalInvitationClaim,
} from "@/lib/operations/auth/server";
import {
  revokePendingClerkPortalInvitations,
  revokePendingClerkStaffInvitations,
} from "@/lib/operations/auth/provision";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { saveUserProfile } from "@/lib/operations/auth/user-profile";
import { fssStudioEnabled } from "@/lib/operations/auth/release-flags";

export const runtime = "nodejs";

export const POST = createPortalAccessClaimHandler({
  configured: portalAuthConfigured,
  origin: resolvePortalOrigin,
  createCorrelationId: randomUUID,
  identity: getPortalIdentity,
  invitationClaim: getPortalInvitationClaim,
  db: getPortalDb,
  claimClerkInvitation: claimClerkPortalInvitation,
  claimStaffInvitation: claimClerkStaffInvitation,
  claimStaffInvitationForVerifiedEmail,
  reconcilePendingClerkStaffInvitations: async (
    email,
    db,
    identity,
    correlationId,
  ) =>
    revokePendingClerkStaffInvitations(
      email,
      await getClaimedInvitationIds(db, identity, "staff", correlationId),
    ),
  reconcilePendingClerkPortalInvitations: async (
    email,
    db,
    identity,
    correlationId,
  ) =>
    revokePendingClerkPortalInvitations(
      email,
      await getClaimedInvitationIds(db, identity, "portal", correlationId),
    ),
  claimPendingInvitation: claimPendingPortalInvitationForVerifiedEmail,
  hasActiveStaffMembership: getActiveStaffMembership,
  claimVerifiedEmailInvite: claimPortalInviteForVerifiedEmail,
  hasActiveMembership: hasActivePortalMembership,
  needsOnboarding: needsPortalOnboarding,
  studioEnabled: fssStudioEnabled,
  saveProfile: saveUserProfile,
  reportUnexpectedError: (report) =>
    console.error("Portal access claim failed.", report),
});
