import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { requestHasRegisteredOrigin } from "@/lib/growth/http/founder-request";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { resolvePortalOrigin } from "@/lib/operations/auth/configuration";

export async function POST(request: Request): Promise<Response> {
  const origin = resolvePortalOrigin();
  if (!requestHasRegisteredOrigin(request, origin))
    return Response.json(
      { message: "Request origin is not allowed." },
      { status: 403 },
    );
  const session = await auth();
  if (session.sessionId)
    await (await clerkClient()).sessions.revokeSession(session.sessionId);
  return NextResponse.redirect(new URL(portalPath("/portal/login"), origin), {
    status: 303,
  });
}
