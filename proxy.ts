import type { NextRequest, NextFetchEvent, NextMiddleware } from "next/server";
import { auth as configuredAuth } from "@/auth";
import { dispatchPortalProxy } from "@/lib/operations/auth/proxy-dispatch";
import { refreshPortalSession } from "@/lib/operations/auth/proxy";
// Auth.js supports direct (request, event) invocation at runtime, but its
// published overloads omit this middleware signature for lazy configuration.
const auth = configuredAuth as unknown as NextMiddleware;

export function proxy(
  request: NextRequest,
  event: NextFetchEvent,
): ReturnType<NextMiddleware> {
  return dispatchPortalProxy(
    request.nextUrl.pathname,
    () => auth(request, event),
    () => refreshPortalSession(request),
  );
}
export const config = {
  matcher: ["/growth/:path*", "/portal/:path*", "/api/portal/:path*"],
};
