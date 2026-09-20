import { randomUUID } from "node:crypto";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { readPortalInvitationClaimFromClerkWebhook } from "@/lib/operations/auth/clerk-webhook";
import {
  readClerkDisplayName,
  readVerifiedPortalUser,
} from "@/lib/operations/auth/verified-user";
import { claimClerkPortalInvitation } from "@/lib/operations/auth/invites";
import { claimClerkStaffInvitation } from "@/lib/operations/auth/staff-invitations";
import { clearPortalInvitationMetadata } from "@/lib/operations/auth/provision";
import { operationsEnabled } from "@/lib/operations/db/client";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { saveUserProfile } from "@/lib/operations/auth/user-profile";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  if (!operationsEnabled()) return new Response(null, { status: 404 });
  let event: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    event = await verifyWebhook(request);
  } catch {
    return Response.json({ message: "Invalid webhook signature." }, { status: 400 });
  }

  try {
    const identity = readVerifiedPortalUser(event.data);
    const displayName = readClerkDisplayName(event.data);
    if (identity && displayName)
      await saveUserProfile(getPortalDb(), identity, displayName, randomUUID());
    const claim = readPortalInvitationClaimFromClerkWebhook(event);
    if (claim) {
      const active = await claimClerkPortalInvitation(
        getPortalDb(),
        claim,
        randomUUID(),
      );
      const staffActive = await claimClerkStaffInvitation(
        getPortalDb(),
        claim,
        randomUUID(),
      );
      if (active || staffActive) await clearPortalInvitationMetadata(claim.clerkUserId);
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Clerk webhook could not be processed.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json({ message: "Webhook could not be processed." }, { status: 503 });
  }
}
