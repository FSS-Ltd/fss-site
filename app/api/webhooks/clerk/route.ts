import { randomUUID } from "node:crypto";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { readPortalIdentityFromClerkWebhook } from "@/lib/operations/auth/clerk-webhook";
import { claimPortalInviteForVerifiedEmail } from "@/lib/operations/auth/invites";
import { operationsEnabled } from "@/lib/operations/db/client";
import { getPortalDb } from "@/lib/operations/db/portal-client";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  if (!operationsEnabled()) return new Response(null, { status: 404 });
  try {
    const event = await verifyWebhook(request);
    const identity = readPortalIdentityFromClerkWebhook(event);
    if (identity)
      await claimPortalInviteForVerifiedEmail(
        getPortalDb(),
        identity,
        randomUUID(),
      );
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Clerk webhook could not be processed.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json({ message: "Webhook rejected." }, { status: 400 });
  }
}
