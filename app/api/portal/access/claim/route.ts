import { randomUUID } from "node:crypto";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { claimPortalInviteForVerifiedEmail } from "@/lib/operations/auth/invites";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { getPortalDb } from "@/lib/operations/db/portal-client";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  if (!portalAuthConfigured())
    return Response.json({ active: false }, { status: 503 });
  try {
    const active = await claimPortalInviteForVerifiedEmail(
      getPortalDb(),
      await getPortalIdentity(),
      randomUUID(),
    );
    return Response.json({ active });
  } catch {
    return Response.json({ active: false }, { status: 401 });
  }
}
