import { randomUUID } from "node:crypto";
import { createPortalAccessClaimHandler } from "./handler";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import {
  claimClerkPortalInvitation,
  claimPortalInviteForVerifiedEmail,
  hasActivePortalMembership,
} from "@/lib/operations/auth/invites";
import {
  claimClerkStaffInvitation,
  claimStaffInvitationForVerifiedEmail,
} from "@/lib/operations/auth/staff-invitations";
import { needsPortalOnboarding } from "@/lib/operations/auth/pending-invitations";
import {
  getPortalIdentity,
  getPortalInvitationClaim,
} from "@/lib/operations/auth/server";
import { getPortalDb } from "@/lib/operations/db/portal-client";

export const runtime = "nodejs";

export const POST = createPortalAccessClaimHandler({
  configured: portalAuthConfigured,
  createCorrelationId: randomUUID,
  identity: getPortalIdentity,
  invitationClaim: getPortalInvitationClaim,
  db: getPortalDb,
  claimClerkInvitation: claimClerkPortalInvitation,
  claimStaffInvitation: claimClerkStaffInvitation,
  claimStaffInvitationForVerifiedEmail,
  claimVerifiedEmailInvite: claimPortalInviteForVerifiedEmail,
  hasActiveMembership: hasActivePortalMembership,
  needsOnboarding: needsPortalOnboarding,
  reportUnexpectedError: (report) =>
    console.error("Portal access claim failed.", report),
});
