import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent, NextMiddleware } from "next/server";
import { auth } from "@/auth";
import { dispatchPortalProxy } from "@/lib/operations/auth/proxy-dispatch";
import { refreshPortalSession } from "@/lib/operations/auth/proxy";
const forwardFounder: NextMiddleware = () => NextResponse.next();
const founderProxy = auth(forwardFounder);

export function proxy(
  request: NextRequest,
  event: NextFetchEvent,
): ReturnType<NextMiddleware> {
  return dispatchPortalProxy(
    request.nextUrl.pathname,
    () => founderProxy(request, event),
    () => refreshPortalSession(request),
  );
}
export const config = {
  matcher: ["/growth/:path*", "/portal/:path*", "/api/portal/:path*"],
};
