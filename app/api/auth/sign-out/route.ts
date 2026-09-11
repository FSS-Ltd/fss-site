import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { requestHasRegisteredOrigin } from "@/lib/growth/http/founder-request";
import { resolveSiteUrl } from "@/lib/config/site-url";

const allowedReturnPaths = new Set(["/growth/login", "/portal/login"]);

export async function POST(request: Request): Promise<Response> {
  const origin = new URL(resolveSiteUrl()).origin;
  if (!requestHasRegisteredOrigin(request, origin))
    return Response.json({ message: "Request origin is not allowed." }, { status: 403 });
  const returnTo = new URL(request.url).searchParams.get("returnTo") ?? "/portal/login";
  const destination = allowedReturnPaths.has(returnTo) ? returnTo : "/portal/login";
  const session = await auth();
  if (session.sessionId) await (await clerkClient()).sessions.revokeSession(session.sessionId);
  return NextResponse.redirect(new URL(destination, origin), { status: 303 });
}
