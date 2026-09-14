import { randomUUID } from "node:crypto";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import {
  claimClerkPortalInvitation,
  claimPortalInviteForVerifiedEmail,
  hasActivePortalMembership,
} from "@/lib/operations/auth/invites";
import { needsPortalOnboarding } from "@/lib/operations/auth/pending-invitations";
import {
  getPortalIdentity,
  getPortalInvitationClaim,
} from "@/lib/operations/auth/server";
import { getPortalDb } from "@/lib/operations/db/portal-client";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  if (!portalAuthConfigured())
    return Response.json({ active: false }, { status: 503 });
  try {
    const identity = await getPortalIdentity();
    const db = getPortalDb();
    const activeFromClerkInvitation = await claimClerkPortalInvitation(
      db,
      await getPortalInvitationClaim(),
      randomUUID(),
    );
    const active =
      activeFromClerkInvitation ||
      (await claimPortalInviteForVerifiedEmail(db, identity, randomUUID())) ||
      (await hasActivePortalMembership(db, identity, randomUUID()));
    if (active) return Response.json({ active: true });
    const onboardingRequired = await needsPortalOnboarding(
      db,
      identity,
      randomUUID(),
    );
    return Response.json({ active: false, onboardingRequired });
  } catch {
    return Response.json({ active: false }, { status: 401 });
  }
}
