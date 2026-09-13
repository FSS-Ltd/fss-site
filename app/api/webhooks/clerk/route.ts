import { randomUUID } from "node:crypto";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { readPortalInvitationClaimFromClerkWebhook } from "@/lib/operations/auth/clerk-webhook";
import { claimClerkPortalInvitation } from "@/lib/operations/auth/invites";
import { clearPortalInvitationMetadata } from "@/lib/operations/auth/provision";
import { operationsEnabled } from "@/lib/operations/db/client";
import { getPortalDb } from "@/lib/operations/db/portal-client";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  if (!operationsEnabled()) return new Response(null, { status: 404 });
  try {
    const event = await verifyWebhook(request);
    const claim = readPortalInvitationClaimFromClerkWebhook(event);
    if (claim) {
      const active = await claimClerkPortalInvitation(
        getPortalDb(),
        claim,
        randomUUID(),
      );
      if (active) await clearPortalInvitationMetadata(claim.clerkUserId);
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Clerk webhook could not be processed.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json({ message: "Webhook rejected." }, { status: 400 });
  }
}
